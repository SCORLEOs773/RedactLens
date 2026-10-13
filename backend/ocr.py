import io
import os

import pymupdf
import pytesseract
from dotenv import load_dotenv
from PIL import Image

load_dotenv()

# Only needed if Tesseract isn't on your PATH (common on Windows)
if os.getenv("TESSERACT_CMD"):
    pytesseract.pytesseract.tesseract_cmd = os.getenv("TESSERACT_CMD")


def extract_text_from_pdf(pdf_bytes: bytes) -> list[dict]:
    """Return a list of {page, text, method} for each page."""
    pages = []
    doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")

    for i, page in enumerate(doc):
        # 1) Try the built-in text layer first (fast, accurate)
        text = page.get_text().strip()
        method = "text-layer"

        # 2) No real text? It's probably a scan, so use OCR
        if len(text) < 20:
            pix = page.get_pixmap(dpi=200)
            image = Image.open(io.BytesIO(pix.tobytes("png")))
            text = pytesseract.image_to_string(image).strip()
            method = "ocr"

        pages.append({"page": i + 1, "text": text, "method": method})

    doc.close()
    return pages