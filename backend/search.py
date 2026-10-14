import json
import re

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from db import supabase
from embeddings import embed_query, embed_texts
from ocr import extract_text_from_pdf

router = APIRouter()

MAX_SIZE = 10 * 1024 * 1024
MAX_TERMS = 500
MAX_CHUNKS = 300
MAX_DOCS_PER_SESSION = 10
SESSION_RE = re.compile(r"^[A-Za-z0-9-]{8,64}$")


def need_db():
    if supabase is None:
        raise HTTPException(status_code=503, detail="Search library is not configured")


def check_session(session_id: str):
    if not SESSION_RE.match(session_id):
        raise HTTPException(status_code=400, detail="Invalid session")


def parse_terms(items: str) -> list[str]:
    try:
        terms = json.loads(items)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid items list")
    if (
        not isinstance(terms, list)
        or not all(isinstance(t, str) for t in terms)
        or len(terms) > MAX_TERMS
    ):
        raise HTTPException(status_code=400, detail="Invalid items list")
    return [t for t in terms if t.strip() and len(t) <= 200]


def redact_text(text: str, terms: list[str]) -> str:
    """Replace each approved item with [REDACTED] (longest first)."""
    for term in sorted(terms, key=len, reverse=True):
        tokens = term.split()
        if not tokens:
            continue
        pattern = r"\s+".join(re.escape(t) for t in tokens)
        text = re.sub(rf"(?<!\w){pattern}(?!\w)", "[REDACTED]", text)
    return text


def chunk_text(text: str, max_chars: int = 800) -> list[str]:
    """Group lines into passages of roughly max_chars."""
    chunks, current = [], ""
    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        while len(line) > max_chars:  # very long line: hard split
            if current:
                chunks.append(current)
                current = ""
            chunks.append(line[:max_chars])
            line = line[max_chars:]
        if current and len(current) + len(line) + 1 > max_chars:
            chunks.append(current)
            current = line
        else:
            current = f"{current} {line}" if current else line
    if current:
        chunks.append(current)
    return chunks


@router.post("/index")
def index_document(
    file: UploadFile = File(...),
    items: str = Form(...),
    session_id: str = Form(...),
):
    need_db()
    check_session(session_id)

    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDF files are supported")
    data = file.file.read()
    if len(data) > MAX_SIZE:
        raise HTTPException(status_code=413, detail="File too large (max 10 MB)")
    terms = parse_terms(items)

    count = (
        supabase.table("documents")
        .select("id", count="exact")
        .eq("session_id", session_id)
        .execute()
        .count
    )
    if count >= MAX_DOCS_PER_SESSION:
        raise HTTPException(
            status_code=429,
            detail=f"Library limit reached ({MAX_DOCS_PER_SESSION} documents). Delete some first.",
        )

    # Redact first, THEN chunk, so personal data never reaches the database
    rows = []
    for page in extract_text_from_pdf(data):
        redacted = redact_text(page["text"], terms)
        for chunk in chunk_text(redacted):
            rows.append({"page": page["page"], "content": chunk})

    if not rows:
        raise HTTPException(status_code=422, detail="No text found in this document")
    if len(rows) > MAX_CHUNKS:
        raise HTTPException(status_code=413, detail="Document too long for the demo")

    vectors = embed_texts([r["content"] for r in rows])

    filename = (file.filename or "document.pdf")[:200]
    doc = (
        supabase.table("documents")
        .insert({"session_id": session_id, "filename": filename})
        .execute()
        .data[0]
    )
    supabase.table("chunks").insert(
        [
            {
                "document_id": doc["id"],
                "session_id": session_id,
                "page": r["page"],
                "content": r["content"],
                "embedding": vec,
            }
            for r, vec in zip(rows, vectors)
        ]
    ).execute()

    return {"document_id": doc["id"], "filename": filename, "chunks": len(rows)}


@router.get("/library")
def library(session_id: str):
    need_db()
    check_session(session_id)
    return (
        supabase.table("documents")
        .select("id, filename, created_at")
        .eq("session_id", session_id)
        .order("created_at", desc=True)
        .execute()
        .data
    )


class SearchRequest(BaseModel):
    session_id: str
    query: str


@router.post("/search")
def search(req: SearchRequest):
    need_db()
    check_session(req.session_id)
    query = req.query.strip()
    if not query or len(query) > 500:
        raise HTTPException(status_code=400, detail="Query must be 1-500 characters")

    vector = embed_query(query)
    return (
        supabase.rpc(
            "match_chunks",
            {"query_embedding": vector, "match_session": req.session_id, "match_count": 5},
        )
        .execute()
        .data
    )


@router.delete("/library")
def clear_library(session_id: str):
    need_db()
    check_session(session_id)
    # Chunks are deleted automatically (on delete cascade)
    supabase.table("documents").delete().eq("session_id", session_id).execute()
    return {"deleted": True}