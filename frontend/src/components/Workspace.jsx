import { useMemo, useState } from "react";
import { indexDocument, redact } from "../api.js";
import { typeInfo } from "../entities.js";

export function Scanning({ name }) {
  const widths = [92, 100, 84, 96, 60, 100, 88, 72, 95, 40];
  return (
    <div className="scan" role="status">
      <div className="sheet">
        {widths.map((w, i) => (
          <div key={i} className="skel" style={{ width: `${w}%` }} />
        ))}
        <div className="scan-line" />
      </div>
      <p>
        Reading {name || "your document"}. The first request can take a minute
        if the server was asleep.
      </p>
    </div>
  );
}

function Marks({ text, entities, rejected, onToggle, view }) {
  const parts = [];
  let cursor = 0;

  entities.forEach((e, i) => {
    if (e.start < cursor) return; // skip overlapping detections
    if (e.start > cursor) parts.push(text.slice(cursor, e.start));

    const key = e.text.trim();
    const kept = rejected.has(key);
    const info = typeInfo(e.entity_type);

    parts.push(
      <span
        key={i}
        role="button"
        tabIndex={0}
        aria-pressed={!kept}
        className="mk"
        data-state={kept ? "keep" : "redact"}
        data-view={view}
        data-review={String(!!e.needs_review)}
        style={{ "--tint": info.tint }}
        title={`${info.label}${e.needs_review ? " (uncertain)" : ""}. Click to ${
          kept ? "redact" : "keep visible"
        }.`}
        onClick={() => onToggle(key)}
        onKeyDown={(ev) => {
          if (ev.key === "Enter" || ev.key === " ") {
            ev.preventDefault();
            onToggle(key);
          }
        }}
      >
        {text.slice(e.start, e.end)}
      </span>,
    );
    cursor = e.end;
  });
  parts.push(text.slice(cursor));
  return <>{parts}</>;
}

export default function Workspace({
  file,
  result,
  rejected,
  setRejected,
  onToggle,
  onReset,
  notify,
}) {
  const [view, setView] = useState("preview");
  const [busy, setBusy] = useState("");
  const [report, setReport] = useState(null);

  // Unique detected items, grouped by type
  const groups = useMemo(() => {
    const items = new Map();
    result.pages.forEach((p) =>
      p.entities.forEach((e) => {
        const text = e.text.trim();
        if (!text) return;
        const info = typeInfo(e.entity_type);
        const existing = items.get(text);
        if (existing) existing.count += 1;
        else
          items.set(text, {
            text,
            label: info.label,
            tint: info.tint,
            count: 1,
          });
      }),
    );
    const byLabel = new Map();
    items.forEach((item) => {
      if (!byLabel.has(item.label)) {
        byLabel.set(item.label, {
          label: item.label,
          tint: item.tint,
          items: [],
        });
      }
      byLabel.get(item.label).items.push(item);
    });
    return [...byLabel.values()];
  }, [result]);

  const all = groups.flatMap((g) => g.items);
  const terms = all.filter((i) => !rejected.has(i.text)).map((i) => i.text);
  const scanned = result.pages
    .filter((p) => p.method === "ocr")
    .map((p) => p.page);

  async function download() {
    setBusy("download");
    setReport(null);
    try {
      const { blob, count, missed } = await redact(file, terms);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "redacted.pdf";
      a.click();
      URL.revokeObjectURL(url);
      setReport(
        missed > 0
          ? {
              kind: "warn",
              text: `Redacted ${count} places, but ${missed} item(s) could not be found in the PDF. Check the file carefully.`,
            }
          : {
              kind: "ok",
              text: `Redacted ${count} places. Open the file and check it before you share it.`,
            },
      );
    } catch (err) {
      setReport({ kind: "err", text: err.message });
    } finally {
      setBusy("");
    }
  }

  async function addToLibrary() {
    setBusy("index");
    try {
      const body = await indexDocument(file, terms);
      notify(
        "ok",
        `Added ${body.filename} to your library (${body.chunks} passages).`,
      );
    } catch (err) {
      notify("err", err.message);
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="workspace">
      <section aria-label="Document">
        <div className="doc-toolbar">
          <div className="seg" role="group" aria-label="View">
            <button
              aria-pressed={view === "preview"}
              onClick={() => setView("preview")}
            >
              Redacted preview
            </button>
            <button
              aria-pressed={view === "detected"}
              onClick={() => setView("detected")}
            >
              Detected items
            </button>
          </div>
          <span className="hint">
            Click any highlight to keep it visible or redact it.
          </span>
        </div>

        {result.pages.map((p) => (
          <article className="page" key={p.page}>
            <p className="page-label">
              Page {p.page}
              {p.method === "ocr" && <span className="badge">Scanned</span>}
            </p>
            <div className="sheet">
              {p.text.trim() ? (
                <Marks
                  text={p.text}
                  entities={p.entities}
                  rejected={rejected}
                  onToggle={onToggle}
                  view={view}
                />
              ) : (
                <em className="muted">No text found on this page.</em>
              )}
            </div>
          </article>
        ))}
      </section>

      <aside className="panel" aria-label="Review">
        <div className="panel-file">
          <span className="file-name">{file.name}</span>
          <button className="btn btn-quiet" onClick={onReset}>
            Change file
          </button>
        </div>

        <p className="summary">
          {terms.length}
          <span>of {all.length} detected items will be redacted</span>
        </p>

        {all.length > 0 && (
          <div className="bulk">
            <button
              className="btn btn-quiet"
              onClick={() => setRejected(new Set())}
            >
              Redact all
            </button>
            <button
              className="btn btn-quiet"
              onClick={() => setRejected(new Set(all.map((i) => i.text)))}
            >
              Keep all
            </button>
          </div>
        )}

        {all.length === 0 && (
          <p className="alert alert-warn">
            No personal data was detected. Read the text before you release it,
            because detection can miss things.
          </p>
        )}

        {groups.map((g) => (
          <div className="group" key={g.label} style={{ "--tint": g.tint }}>
            <h3>
              <span className="swatch" />
              {g.label}
            </h3>
            {g.items.map((item) => (
              <label className="row" key={item.text}>
                <input
                  type="checkbox"
                  role="switch"
                  className="switch"
                  checked={!rejected.has(item.text)}
                  onChange={() => onToggle(item.text)}
                />
                <span className="txt">{item.text.replace(/\s+/g, " ")}</span>
                {item.count > 1 && <span className="n">×{item.count}</span>}
              </label>
            ))}
          </div>
        ))}

        {scanned.length > 0 && (
          <p className="alert alert-warn">
            Pages {scanned.join(", ")} are scans. Redaction there depends on OCR
            accuracy, and those pages become images in the export. Check them
            carefully.
          </p>
        )}
        {report && (
          <p className={`alert alert-${report.kind}`}>{report.text}</p>
        )}

        <div className="actions">
          <button
            className="btn btn-primary"
            onClick={download}
            disabled={busy !== "" || terms.length === 0}
          >
            {busy === "download" ? "Redacting..." : "Download redacted PDF"}
          </button>
          <button className="btn" onClick={addToLibrary} disabled={busy !== ""}>
            {busy === "index" ? "Adding..." : "Add to search library"}
          </button>
        </div>
        <p className="note">
          The library stores only the redacted text, and only you can see it.
        </p>
      </aside>
    </div>
  );
}
