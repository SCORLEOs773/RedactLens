import { useCallback, useEffect, useState } from "react";
import Header from "./components/Header.jsx";
import Landing from "./components/Landing.jsx";
import Workspace, { Scanning } from "./components/Workspace.jsx";
import SearchView from "./components/SearchView.jsx";
import { extract } from "./api.js";

export default function App() {
  const [view, setView] = useState("redact");
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [rejected, setRejected] = useState(() => new Set());
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState(null);

  const notify = useCallback((kind, text) => setNotice({ kind, text }), []);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 8000);
    return () => clearTimeout(t);
  }, [notice]);

  async function loadFile(selected) {
    if (!selected) return;
    if (selected.type !== "application/pdf") {
      notify("err", "Only PDF files are supported.");
      return;
    }
    setFile(selected);
    setResult(null);
    setRejected(new Set());
    setLoading(true);
    try {
      setResult(await extract(selected));
    } catch (err) {
      setFile(null);
      notify("err", err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadSample() {
    try {
      const res = await fetch("/sample-letter.pdf");
      const blob = await res.blob();
      if (blob.type !== "application/pdf") throw new Error("missing");
      await loadFile(
        new File([blob], "sample-letter.pdf", { type: "application/pdf" }),
      );
    } catch {
      notify(
        "err",
        "Sample letter not found. Add sample-letter.pdf to frontend/public.",
      );
    }
  }

  function reset() {
    setFile(null);
    setResult(null);
    setRejected(new Set());
  }

  function toggle(key) {
    setRejected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  let content;
  if (view === "search") {
    content = <SearchView onGo={() => setView("redact")} notify={notify} />;
  } else if (loading) {
    content = <Scanning name={file?.name} />;
  } else if (result) {
    content = (
      <Workspace
        file={file}
        result={result}
        rejected={rejected}
        setRejected={setRejected}
        onToggle={toggle}
        onReset={reset}
        notify={notify}
      />
    );
  } else {
    content = <Landing onFile={loadFile} onSample={loadSample} />;
  }

  return (
    <div className="app">
      <Header view={view} onView={setView} />
      <main>{content}</main>
      <footer>
        RedactLens is a demo. Detection can miss things, so always check a
        redacted file before you share it.
      </footer>
      {notice && (
        <div className={`toast alert alert-${notice.kind}`} role="status">
          <span>{notice.text}</span>
          <button onClick={() => setNotice(null)}>Dismiss</button>
        </div>
      )}
    </div>
  );
}
