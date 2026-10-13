import { useState } from "react";

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

function HighlightedText({ text, entities }) {
  const parts = [];
  let cursor = 0;

  entities.forEach((e, i) => {
    if (e.start < cursor) return; // skip overlapping detections
    if (e.start > cursor) parts.push(text.slice(cursor, e.start));
    parts.push(
      <mark
        key={i}
        title={`${e.entity_type} (confidence ${e.score})${
          e.needs_review ? " - low confidence, check carefully" : ""
        }`}
        style={{
          background: COLORS[e.entity_type] || "#ffe08a",
          padding: "0 2px",
          borderRadius: 3,
          outline: e.needs_review ? "1px dashed #666" : "none",
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
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    setError("");
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);

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

  const totalFound = result
    ? result.pages.reduce((sum, p) => sum + p.entities.length, 0)
    : 0;

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: 24 }}>
      <h1>RedactLens</h1>
      <p>Demo only. Do not upload real personal documents.</p>

      <input type="file" accept="application/pdf" onChange={handleUpload} />

      {loading && <p>Processing... (first request may take a while)</p>}
      {error && <p style={{ color: "crimson" }}>{error}</p>}

      {result && (
        <>
          <p>
            <strong>{totalFound}</strong> possible personal data items found.
            Hover a highlight to see its type.
          </p>
          {result.pages.map((p) => (
            <div key={p.page} style={{ marginTop: 16 }}>
              <strong>
                Page {p.page} <em>({p.method})</em>
              </strong>
              <HighlightedText text={p.text} entities={p.entities} />
            </div>
          ))}
        </>
      )}
    </div>
  );
}

export default App;
