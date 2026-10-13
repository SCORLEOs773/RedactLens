from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from ocr import extract_text_from_pdf
from pii import detect_pii

app = FastAPI(title="RedactLens API")

# CORS: lets our React app (on a different port) call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

MAX_SIZE = 10 * 1024 * 1024  # 10 MB


@app.get("/health")
def health():
    return {"status": "ok", "app": "RedactLens"}


@app.post("/extract")
def extract(file: UploadFile = File(...)):
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    data = file.file.read()
    if len(data) > MAX_SIZE:
        raise HTTPException(status_code=413, detail="File too large (max 10 MB)")

    pages = extract_text_from_pdf(data)
    for page in pages:
        page["entities"] = detect_pii(page["text"])
    return {"filename": file.filename, "pages": pages}