import { useCallback, useEffect, useState } from "react";
import { clearLibrary, getLibrary, search } from "../api.js";

function Redacted({ text }) {
  return text.split(/(\[REDACTED\])/g).map((part, i) =>
    part === "[REDACTED]" ? (
      <span className="bar" key={i}>
        redacted
      </span>
    ) : (
      part
    ),
  );
}

export default function SearchView({ onGo, notify }) {
  const [docs, setDocs] = useState(null); // null while loading
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setDocs(await getLibrary());
    } catch (err) {
      setDocs([]);
      notify("err", err.message);
    }
  }, [notify]);

  useEffect(() => {
    load();
  }, [load]);

  async function run(e) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setBusy(true);
    try {
      setResults(await search(q));
    } catch (err) {
      notify("err", err.message);
    } finally {
      setBusy(false);
    }
  }

  async function clear() {
    if (!window.confirm("Delete every document in your library?")) return;
    try {
      await clearLibrary();
      setDocs([]);
      setResults(null);
      notify("ok", "Your library has been deleted.");
    } catch (err) {
      notify("err", err.message);
    }
  }

  if (docs === null)
    return (
      <p className="muted" role="status">
        Loading your library...
      </p>
    );

  if (docs.length === 0) {
    return (
      <div className="empty">
        <h2>Your library is empty</h2>
        <p>
          Redact a document and choose Add to search library. You can then
          search across everything you have processed, by meaning rather than
          exact words.
        </p>
        <button className="btn btn-primary" onClick={onGo}>
          Redact a document
        </button>
      </div>
    );
  }

  return (
    <div className="search-wrap">
      <h2>Search library</h2>
      <p className="muted">
        Ask in plain language. Redacted details appear as black bars.
      </p>

      <form className="search-form" onSubmit={run}>
        <input
          className="search-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="For example: complaints about noise near schools"
          aria-label="Search your documents"
        />
        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? "Searching..." : "Search"}
        </button>
      </form>

      {results && results.length === 0 && (
        <p className="muted" style={{ marginTop: 16 }}>
          No matches found.
        </p>
      )}
      {results &&
        results.map((r) => (
          <article className="result" key={r.id}>
            <strong>{r.filename}</strong>{" "}
            <span className="muted">
              Page {r.page}, {Math.round(r.similarity * 100)}% match
            </span>
            <p>
              <Redacted text={r.content} />
            </p>
          </article>
        ))}

      <section className="library">
        <h2 style={{ fontSize: "1.125rem" }}>
          Documents in your library ({docs.length})
        </h2>
        <ul>
          {docs.map((d) => (
            <li key={d.id}>{d.filename}</li>
          ))}
        </ul>
        <button className="btn" style={{ marginTop: 14 }} onClick={clear}>
          Delete all documents
        </button>
      </section>
    </div>
  );
}
