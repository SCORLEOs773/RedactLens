function Logo() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
      <rect
        x="1"
        y="1"
        width="26"
        height="26"
        rx="5"
        fill="#fff"
        stroke="#1a2233"
        strokeWidth="2"
      />
      <rect x="6" y="7" width="16" height="3" fill="#9aa6bd" />
      <rect x="6" y="12.5" width="12" height="4" fill="#000" />
      <rect x="6" y="19" width="9" height="3" fill="#9aa6bd" />
    </svg>
  );
}

export default function Header({ view, onView }) {
  return (
    <header className="header">
      <div className="header-inner">
        <div className="brand">
          <Logo />
          RedactLens
        </div>
        <nav className="tabs" aria-label="Main">
          <button
            className="tab"
            aria-current={view === "redact" ? "page" : undefined}
            onClick={() => onView("redact")}
          >
            Redact
          </button>
          <button
            className="tab"
            aria-current={view === "search" ? "page" : undefined}
            onClick={() => onView("search")}
          >
            Search library
          </button>
        </nav>
        <span className="demo-tag">Demo: use fake documents only</span>
      </div>
    </header>
  );
}
