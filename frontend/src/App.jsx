import { useState } from "react";

const API_URL = import.meta.env.VITE_API_URL;

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
        body: formData, // don't set Content-Type yourself; the browser does it
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

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: 24 }}>
      <h1>RedactLens</h1>
      <p>Demo only. Do not upload real personal documents.</p>

      <input type="file" accept="application/pdf" onChange={handleUpload} />

      {loading && (
        <p>
          Processing... (first request may take a while if the server is waking
          up)
        </p>
      )}
      {error && <p style={{ color: "crimson" }}>{error}</p>}

      {result &&
        result.pages.map((p) => (
          <div key={p.page} style={{ marginTop: 16 }}>
            <strong>
              Page {p.page} <em>({p.method})</em>
            </strong>
            <pre style={{ whiteSpace: "pre-wrap" }}>{p.text}</pre>
          </div>
        ))}
    </div>
  );
}

export default App;
