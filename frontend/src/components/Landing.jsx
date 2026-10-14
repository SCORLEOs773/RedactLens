import { useState } from "react";

const Mk = ({ i, children }) => (
  <span className="sp-mark" style={{ "--i": i }}>
    {children}
  </span>
);

export default function Landing({ onFile, onSample }) {
  const [over, setOver] = useState(false);
  const [run, setRun] = useState(0);

  return (
    <>
      <section className="hero">
        <div>
          <h1>Black out personal data before a document goes public.</h1>
          <p className="lede">
            Upload a PDF. RedactLens finds names, contact details and PPS
            numbers, you confirm each one, and it exports a copy where that text
            is gone for good.
          </p>

          <label
            className="drop"
            data-over={over}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setOver(false);
              onFile(e.dataTransfer.files[0]);
            }}
          >
            <input
              className="sr-only"
              type="file"
              accept="application/pdf"
              onChange={(e) => {
                onFile(e.target.files[0]);
                e.target.value = "";
              }}
            />
            <span className="drop-title">Drop a PDF here</span>
            <span className="drop-sub">
              or click to choose a file. Up to 10 MB.
            </span>
          </label>

          <div className="drop-row">
            <button className="btn btn-quiet" onClick={onSample}>
              Try a sample letter
            </button>
          </div>
          <p className="drop-fine">
            Files are processed in memory and are not stored unless you add them
            to your library.
          </p>
        </div>

        <div>
          <div
            className="specimen"
            aria-label="Example of a letter being redacted"
          >
            <div className="sheet" key={run}>
              <p>Dear Council,</p>
              <p>
                I am writing about the noise from building work next to St
                Brigid's school. My name is <Mk i={0}>Aoife Brennan</Mk> and I
                live at <Mk i={1}>14 Elm Park, Dublin 4</Mk>. You can reach me
                on <Mk i={2}>087 123 4567</Mk> or{" "}
                <Mk i={3}>aoife.brennan@example.com</Mk>.
              </p>
              <p>
                My PPS number is <Mk i={4}>1234567T</Mk>.
              </p>
              <p>Yours sincerely</p>
            </div>
          </div>
          <div className="specimen-foot">
            <span>Sample letter with invented details.</span>
            <button
              className="btn btn-quiet"
              onClick={() => setRun((n) => n + 1)}
            >
              Replay
            </button>
          </div>
        </div>
      </section>

      <ol className="steps">
        <li>
          <h3>Upload a PDF</h3>
          <p>Digital or scanned. Scanned pages are read with OCR.</p>
        </li>
        <li>
          <h3>Confirm what to hide</h3>
          <p>
            Every name, number and address is highlighted. Click anything that
            should stay visible.
          </p>
        </li>
        <li>
          <h3>Export a clean copy</h3>
          <p>
            The text is deleted from the file, not just covered, and hidden
            metadata is cleared.
          </p>
        </li>
      </ol>
    </>
  );
}
