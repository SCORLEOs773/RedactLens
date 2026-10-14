from fastembed import TextEmbedding

_model = None


def get_model() -> TextEmbedding:
    # Loaded on first use, so the server starts fast
    global _model
    if _model is None:
        _model = TextEmbedding("BAAI/bge-small-en-v1.5")  # 384 dimensions
    return _model


def embed_texts(texts: list[str]) -> list[list[float]]:
    return [v.tolist() for v in get_model().embed(texts)]


def embed_query(query: str) -> list[float]:
    return list(get_model().query_embed([query]))[0].tolist()