const API_URL = import.meta.env.VITE_API_URL;

// A random ID per browser, so each visitor only sees their own library
const fallbackId = crypto.randomUUID();
export const SESSION_ID = (() => {
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
})();

async function request(path, options, fallback) {
  let res;
  try {
    res = await fetch(`${API_URL}${path}`, options);
  } catch {
    throw new Error(
      "Can't reach the server. It may be waking up, so try again in a minute.",
    );
  }
  if (!res.ok) {
    let detail = fallback;
    try {
      const body = await res.json();
      if (typeof body.detail === "string") detail = body.detail;
    } catch {
      /* response was not JSON */
    }
    throw new Error(detail);
  }
  return res;
}

function form(fields) {
  const data = new FormData();
  Object.entries(fields).forEach(([k, v]) => data.append(k, v));
  return data;
}

export async function extract(file) {
  const res = await request(
    "/extract",
    { method: "POST", body: form({ file }) },
    "Upload failed",
  );
  return res.json();
}

export async function redact(file, terms) {
  const res = await request(
    "/redact",
    { method: "POST", body: form({ file, items: JSON.stringify(terms) }) },
    "Redaction failed",
  );
  return {
    blob: await res.blob(),
    count: Number(res.headers.get("X-Redaction-Count") || 0),
    missed: Number(res.headers.get("X-Redaction-Missed") || 0),
  };
}

export async function indexDocument(file, terms) {
  const res = await request(
    "/index",
    {
      method: "POST",
      body: form({
        file,
        items: JSON.stringify(terms),
        session_id: SESSION_ID,
      }),
    },
    "Could not add the document",
  );
  return res.json();
}

export async function getLibrary() {
  const res = await request(
    `/library?session_id=${SESSION_ID}`,
    {},
    "Could not load your library",
  );
  return res.json();
}

export async function search(query) {
  const res = await request(
    "/search",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: SESSION_ID, query }),
    },
    "Search failed",
  );
  return res.json();
}

export async function clearLibrary() {
  await request(
    `/library?session_id=${SESSION_ID}`,
    { method: "DELETE" },
    "Could not delete your library",
  );
}
