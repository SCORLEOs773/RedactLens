from presidio_analyzer import AnalyzerEngine, Pattern, PatternRecognizer
from presidio_analyzer.nlp_engine import NlpEngineProvider


def build_analyzer() -> AnalyzerEngine:
    # Use the small spaCy model (low memory)
    nlp_config = {
        "nlp_engine_name": "spacy",
        "models": [{"lang_code": "en", "model_name": "en_core_web_sm"}],
    }
    nlp_engine = NlpEngineProvider(nlp_configuration=nlp_config).create_engine()
    analyzer = AnalyzerEngine(nlp_engine=nlp_engine, supported_languages=["en"])

    # Custom Irish recognizers (regex patterns)
    ppsn = PatternRecognizer(
        supported_entity="IE_PPSN",
        patterns=[Pattern("ppsn", r"\b\d{7}[A-Za-z]{1,2}\b", 0.6)],
        context=["pps", "ppsn", "personal public service"],
    )
    ie_phone = PatternRecognizer(
        supported_entity="IE_PHONE",
        patterns=[Pattern("ie_mobile", r"(?:\+353\s?|\b0)8\d\s?\d{3}\s?\d{4}\b", 0.7)],
        context=["phone", "mobile", "tel", "call"],
    )
    eircode = PatternRecognizer(
        supported_entity="IE_EIRCODE",
        patterns=[
            Pattern("eircode", r"\b[AC-FHKNPRTV-Y]\d{2}\s?[0-9AC-FHKNPRTV-Y]{4}\b", 0.5)
        ],
        context=["eircode", "postcode", "address"],
    )
    for recognizer in (ppsn, ie_phone, eircode):
        analyzer.registry.add_recognizer(recognizer)

    return analyzer


# Built once at startup, because loading the model is slow
analyzer = build_analyzer()

ENTITIES = [
    "PERSON",
    "EMAIL_ADDRESS",
    "PHONE_NUMBER",
    "LOCATION",
    "IE_PPSN",
    "IE_PHONE",
    "IE_EIRCODE",
]


# Terms the NER model wrongly flags as people/places. Add more as you find them.
IGNORE_TERMS = {
    "roblox", "bitbucket", "jira", "kotlin", "adobe", "express",
    "studio", "design", "redesigned", "react", "angular", "github",
}

# Detections that come from the language model (less reliable than patterns)
NER_TYPES = {"PERSON", "LOCATION"}


def detect_pii(text: str) -> list[dict]:
    results = analyzer.analyze(
        text=text, language="en", entities=ENTITIES, score_threshold=0.4
    )
    findings = []
    for r in sorted(results, key=lambda r: r.start):
        span = text[r.start : r.end].strip()

        # Drop known false positives from the language model
        if r.entity_type in NER_TYPES and span.lower() in IGNORE_TERMS:
            continue

        findings.append(
            {
                "entity_type": r.entity_type,
                "start": r.start,
                "end": r.end,
                "score": round(r.score, 2),
                "text": text[r.start : r.end],
                # Single-word model guesses are the shakiest, so flag them
                "needs_review": r.entity_type in NER_TYPES and " " not in span,
            }
        )
    return findings