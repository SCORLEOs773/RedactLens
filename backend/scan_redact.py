import io
import re

import pytesseract
from PIL import Image, ImageDraw

import ocr  # noqa: F401  (importing this configures the Tesseract path)


def norm(s: str) -> str:
    """Lowercase and strip surrounding punctuation so 'Brennan,' matches 'Brennan'."""
    return re.sub(r"^\W+|\W+$", "", s).casefold()


def redact_scanned_page(page, terms: list[str], dpi: int = 200):
    """Render a scanned page, black out matching words, return (image, found_terms, count)."""
    pix = page.get_pixmap(dpi=dpi)
    image = Image.open(io.BytesIO(pix.tobytes("png"))).convert("RGB")

    # OCR with word positions
    data = pytesseract.image_to_data(image, output_type=pytesseract.Output.DICT)
    words = []
    for i, raw in enumerate(data["text"]):
        n = norm(raw)
        if not n:
            continue
        x0, y0 = data["left"][i], data["top"][i]
        x1, y1 = x0 + data["width"][i], y0 + data["height"][i]
        words.append({"norm": n, "box": (x0, y0, x1, y1)})

    draw = ImageDraw.Draw(image)
    found = set()
    count = 0
    pad = 3  # a little margin so no edge pixels peek out

    for term in terms:
        tokens = [t for t in (norm(p) for p in term.split()) if t]
        if not tokens:
            continue
        size = len(tokens)
        for i in range(len(words) - size + 1):
            if all(words[i + j]["norm"] == tokens[j] for j in range(size)):
                for j in range(size):
                    x0, y0, x1, y1 = words[i + j]["box"]
                    draw.rectangle((x0 - pad, y0 - pad, x1 + pad, y1 + pad), fill="black")
                found.add(term)
                count += 1

    return image, found, count