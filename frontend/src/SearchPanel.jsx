import { useCallback, useEffect, useState } from "react";

const API_URL = import.meta.env.VITE_API_URL;

// A random ID per browser, so each visitor only sees their own documents
const fallbackId = crypto.randomUUID();
function getSessionId() {
  try {
    let id = localStorage.getItem("redactlens_session");
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("redactlens_session", id);
    }
    return id;
  } catch {
    return fallbackId;
  }
}
const SESSION_ID = getSessionId();

export default function SearchPanel({ file, terms }) {
  const [docs, setDocs] = useState([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadLibrary = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/library?session_id=${SESSION_ID}`);
      if (res.ok) setDocs(await res.json());
    } catch {
      /* backend asleep or offline */
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadLibrary();
  }, [loadLibrary]);

  async function addToLibrary() {
    setBusy("index");
    setError("");
    setMessage("");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("items", JSON.stringify(terms));
    formData.append("session_id", SESSION_ID);

    try {
      const res = await fetch(`${API_URL}/index`, {
        method: "POST",
        body: formData,
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.detail || "Indexing failed");
      setMessage(`Added "${body.filename}" (${body.chunks} passages indexed).`);
      loadLibrary();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  async function runSearch(e) {
    e.preventDefault();
    if (!query.trim()) return;
    setBusy("search");
    setError("");

    try {
      const res = await fetch(`${API_URL}/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: SESSION_ID, query }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.detail || "Search failed");
      setResults(body);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  async function clearLibrary() {
    if (!window.confirm("Delete all documents you added to the library?"))
      return;
    await fetch(`${API_URL}/library?session_id=${SESSION_ID}`, {
      method: "DELETE",
    });
    setDocs([]);
    setResults(null);
    setMessage("Your library has been deleted.");
  }

  return (
    <div style={{ marginTop: 40, borderTop: "1px solid #ccc", paddingTop: 16 }}>
      <h2>Search library</h2>
      <p>
        <small>
          Only the redacted text is stored, and only you can see it (it is tied
          to this browser).
        </small>
      </p>

      {file && (
        <button onClick={addToLibrary} disabled={busy === "index"}>
          {busy === "index"
            ? "Indexing... (first time downloads a model)"
            : `Add "${file.name}" to library (${terms.length} items redacted)`}
        </button>
      )}

      {message && <p style={{ color: "darkgreen" }}>{message}</p>}
      {error && <p style={{ color: "crimson" }}>{error}</p>}

      <p>
        {docs.length} document(s) in your library
        {docs.length > 0 && (
          <>
            {" "}
            <button onClick={clearLibrary}>Delete all</button>
          </>
        )}
      </p>
      {docs.length > 0 && (
        <ul>
          {docs.map((d) => (
            <li key={d.id}>{d.filename}</li>
          ))}
        </ul>
      )}

      <form onSubmit={runSearch} style={{ marginTop: 12 }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask e.g. complaints about noise near schools"
          style={{ width: "70%", padding: 6 }}
        />{" "}
        <button type="submit" disabled={busy === "search" || docs.length === 0}>
          {busy === "search" ? "Searching..." : "Search"}
        </button>
      </form>

      {results && results.length === 0 && <p>No results.</p>}
      {results &&
        results.map((r) => (
          <div
            key={r.id}
            style={{
              marginTop: 12,
              padding: 8,
              background: "#f5f5f5",
              color: "#222",
            }}
          >
            <strong>{r.filename}</strong> - page {r.page}{" "}
            <small>(match {Math.round(r.similarity * 100)}%)</small>
            <p style={{ whiteSpace: "pre-wrap", margin: "4px 0 0" }}>
              {r.content}
            </p>
          </div>
        ))}
    </div>
  );
}
