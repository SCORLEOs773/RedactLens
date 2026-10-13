import json

import pymupdf
from fastapi import FastAPI, File, Form, HTTPException, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from ocr import extract_text_from_pdf
from pii import detect_pii

app = FastAPI(title="RedactLens API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Redaction-Count", "X-Redaction-Missed"],
)

MAX_SIZE = 10 * 1024 * 1024  # 10 MB
MAX_TERMS = 500


def read_pdf_upload(file: UploadFile) -> bytes:
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDF files are supported")
    data = file.file.read()
    if len(data) > MAX_SIZE:
        raise HTTPException(status_code=413, detail="File too large (max 10 MB)")
    return data


def find_rects(page, term: str):
    """Find where a piece of text appears on a page."""
    rects = page.search_for(" ".join(term.split()))
    # Text that wraps across lines: try each line separately
    if not rects and "\n" in term:
        for segment in term.splitlines():
            segment = segment.strip()
            if segment:
                rects += page.search_for(segment)
    return rects


@app.get("/health")
def health():
    return {"status": "ok", "app": "RedactLens"}


@app.post("/extract")
def extract(file: UploadFile = File(...)):
    data = read_pdf_upload(file)
    pages = extract_text_from_pdf(data)
    for page in pages:
        page["entities"] = detect_pii(page["text"])
    return {"filename": file.filename, "pages": pages}


@app.post("/redact")
def redact(file: UploadFile = File(...), items: str = Form(...)):
    data = read_pdf_upload(file)

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
    terms = [t for t in terms if t.strip() and len(t) <= 200]

    doc = pymupdf.open(stream=data, filetype="pdf")

    # Fail closed: we can't redact scanned pages yet
    scanned = [p.number + 1 for p in doc if len(p.get_text().strip()) < 20]
    if scanned and terms:
        doc.close()
        raise HTTPException(
            status_code=422,
            detail=f"Pages {scanned} are scanned images and can't be redacted yet.",
        )

    found_terms = set()
    count = 0
    for page in doc:
        for term in terms:
            rects = find_rects(page, term)
            if rects:
                found_terms.add(term)
            for rect in rects:
                page.add_redact_annot(rect, fill=(0, 0, 0))
                count += 1
        page.apply_redactions()  # actually deletes the text underneath

    missed = len(set(terms) - found_terms)

    # Remove hidden metadata (author, title, etc.)
    doc.set_metadata({})
    doc.del_xml_metadata()

    output = doc.tobytes(garbage=4, deflate=True)
    doc.close()

    return Response(
        content=output,
        media_type="application/pdf",
        headers={
            "Content-Disposition": 'attachment; filename="redacted.pdf"',
            "X-Redaction-Count": str(count),
            "X-Redaction-Missed": str(missed),
        },
    )