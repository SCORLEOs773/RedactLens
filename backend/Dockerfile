FROM python:3.12-slim

# Tesseract is a system program, so it must be installed in the image
RUN apt-get update \
    && apt-get install -y --no-install-recommends tesseract-ocr \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Make sure the spaCy model exists and pre-download the embedding model
ENV FASTEMBED_CACHE_PATH=/app/model_cache
RUN python -m spacy download en_core_web_sm \
    && python -c "from fastembed import TextEmbedding; TextEmbedding('BAAI/bge-small-en-v1.5')"

COPY . .

CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}