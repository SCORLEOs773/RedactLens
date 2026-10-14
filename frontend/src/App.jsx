import { useMemo, useState } from "react";

import SearchPanel from "./SearchPanel.jsx";

const API_URL = import.meta.env.VITE_API_URL;

const COLORS = {
  PERSON: "#ffd6a5",
  EMAIL_ADDRESS: "#bde0fe",
  PHONE_NUMBER: "#caffbf",
  IE_PHONE: "#caffbf",
  LOCATION: "#e0c3fc",
  IE_PPSN: "#ffadad",
  IE_EIRCODE: "#e0c3fc",
};

function HighlightedText({ text, entities, rejected, onToggle }) {
  const parts = [];
  let cursor = 0;

  entities.forEach((e, i) => {
    if (e.start < cursor) return; // skip overlapping detections
    if (e.start > cursor) parts.push(text.slice(cursor, e.start));

    const key = e.text.trim();
    const isRejected = rejected.has(key);

    parts.push(
      <mark
        key={i}
        onClick={() => onToggle(key)}
        title={`${e.entity_type} (confidence ${e.score}) - click to ${
          isRejected ? "redact" : "keep"
        }`}
        style={{
          background: isRejected
            ? "transparent"
            : COLORS[e.entity_type] || "#ffe08a",
          outline: isRejected
            ? "1px dotted #999"
            : e.needs_review
              ? "1px dashed #666"
              : "none",
          cursor: "pointer",
          padding: "0 2px",
          borderRadius: 3,
        }}
      >
        {text.slice(e.start, e.end)}
      </mark>,
    );
    cursor = e.end;
  });
  parts.push(text.slice(cursor));

  return <pre style={{ whiteSpace: "pre-wrap" }}>{parts}</pre>;
}

function App() {
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [rejected, setRejected] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [redacting, setRedacting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // One entry per unique detected text
  const items = useMemo(() => {
    if (!result) return [];
    const map = new Map();
    result.pages.forEach((p) =>
      p.entities.forEach((e) => {
        const key = e.text.trim();
        if (!key) return;
        const existing = map.get(key);
        if (existing) existing.count += 1;
        else map.set(key, { text: key, type: e.entity_type, count: 1 });
      }),
    );
    return [...map.values()];
  }, [result]);

  const acceptedItems = items.filter((i) => !rejected.has(i.text));
  const scannedPages = result
    ? result.pages.filter((p) => p.method === "ocr").map((p) => p.page)
    : [];

  function toggle(key) {
    setRejected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleUpload(e) {
    const selected = e.target.files[0];
    if (!selected) return;

    setFile(selected);
    setLoading(true);
    setError("");
    setNotice("");
    setResult(null);
    setRejected(new Set());

    const formData = new FormData();
    formData.append("file", selected);

    try {
      const res = await fetch(`${API_URL}/extract`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Upload failed");
      }
      setResult(await res.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRedact() {
    setRedacting(true);
    setError("");
    setNotice("");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("items", JSON.stringify(acceptedItems.map((i) => i.text)));

    try {
      const res = await fetch(`${API_URL}/redact`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Redaction failed");
      }

      const count = res.headers.get("X-Redaction-Count");
      const missed = Number(res.headers.get("X-Redaction-Missed") || 0);

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "redacted.pdf";
      a.click();
      URL.revokeObjectURL(url);

      setNotice(
        `Redacted ${count} places.` +
          (missed > 0
            ? ` ${missed} item(s) could not be located in the PDF, so check the output carefully.`
            : ""),
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setRedacting(false);
    }
  }

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: 24 }}>
      <h1>RedactLens</h1>
      <p>Demo only. Do not upload real personal documents.</p>

      <input type="file" accept="application/pdf" onChange={handleUpload} />

      {loading && <p>Processing... (first request may take a while)</p>}
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      {notice && <p style={{ color: "darkgreen" }}>{notice}</p>}

      {result && (
        <>
          {scannedPages.length > 0 && (
            <p style={{ color: "darkorange" }}>
              Pages {scannedPages.join(", ")} are scanned images. Redaction
              there depends on OCR accuracy, and those pages become
              non-searchable images in the output. Check them carefully.
            </p>
          )}

          <h2>
            Detected items ({acceptedItems.length} of {items.length} will be
            redacted)
          </h2>
          <p>
            Untick anything that should stay visible. You can also click
            highlights below.
          </p>
          <ul style={{ listStyle: "none", padding: 0 }}>
            {items.map((item) => (
              <li key={item.text} style={{ marginBottom: 4 }}>
                <label>
                  <input
                    type="checkbox"
                    checked={!rejected.has(item.text)}
                    onChange={() => toggle(item.text)}
                  />{" "}
                  <span
                    style={{
                      background: COLORS[item.type] || "#ffe08a",
                      padding: "0 4px",
                      borderRadius: 3,
                    }}
                  >
                    {item.text.replace(/\s+/g, " ")}
                  </span>{" "}
                  <small>
                    {item.type} x{item.count}
                  </small>
                </label>
              </li>
            ))}
          </ul>

          <button
            onClick={handleRedact}
            disabled={redacting || acceptedItems.length === 0}
          >
            {redacting ? "Redacting..." : "Download redacted PDF"}
          </button>
          <p>
            <small>
              Always check the redacted PDF yourself before sharing it.
            </small>
          </p>

          {result.pages.map((p) => (
            <div key={p.page} style={{ marginTop: 16 }}>
              <strong>
                Page {p.page} <em>({p.method})</em>
              </strong>
              <HighlightedText
                text={p.text}
                entities={p.entities}
                rejected={rejected}
                onToggle={toggle}
              />
            </div>
          ))}
        </>
      )}

      <SearchPanel file={file} terms={acceptedItems.map((i) => i.text)} />
    </div>
  );
}

export default App;