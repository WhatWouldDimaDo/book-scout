import { parseAvailability, parseSearchResults } from "./polaris-parser.mjs";

const CATALOG_BASE = "https://dekalb.polarislibrary.com/polaris";
const CATALOG_CONTEXT = "22.1033.0.0.6";
const PRINT_FILTER = "TOM=bks NOT TOM=ebk NOT TOM=elr NOT TOM=abk";
const USER_AGENT = "Dewey library availability proof-of-concept (contact: hello@dimadimadima.com)";
const TIMEOUT_MS = 10000;
const MAX_RESPONSE_BYTES = 750_000;

async function readLimitedText(response) {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
    throw new Error("Polaris response exceeds size limit");
  }
  const reader = response.body?.getReader();
  if (!reader) return response.text();
  const decoder = new TextDecoder();
  let received = 0;
  let body = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new Error("Polaris response exceeds size limit");
    }
    body += decoder.decode(value, { stream: true });
  }
  return body + decoder.decode();
}

function createAnonymousSession() {
  const cookies = new Map();

  function rememberCookies(headers) {
    const values = typeof headers.getSetCookie === "function"
      ? headers.getSetCookie()
      : [headers.get("set-cookie")].filter(Boolean);
    for (const value of values) {
      const pair = value.split(";", 1)[0];
      const separator = pair.indexOf("=");
      if (separator > 0) cookies.set(pair.slice(0, separator).trim(), pair.slice(separator + 1).trim());
    }
  }

  async function getText(initialUrl) {
    let url = initialUrl;
    for (let redirects = 0; redirects <= 8; redirects += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      let response;
      try {
        response = await fetch(url, {
          headers: {
            "User-Agent": USER_AGENT,
            Accept: "text/html, */*;q=0.8",
            ...(cookies.size ? { Cookie: [...cookies].map(([name, value]) => `${name}=${value}`).join("; ") } : {}),
          },
          cache: "no-store",
          redirect: "manual",
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }
      rememberCookies(response.headers);
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) throw new Error("Polaris redirect omitted a location");
        await response.body?.cancel();
        url = new URL(location, url).toString();
        continue;
      }
      if (!response.ok) throw new Error(`Polaris request failed: ${response.status}`);
      const body = await readLimitedText(response);
      const objectMoved = body.match(/Object moved to\s*<a\s+href="([^"]+)"/i)?.[1];
      if (objectMoved) {
        url = new URL(objectMoved.replace(/&amp;/gi, "&"), url).toString();
        continue;
      }
      return body;
    }
    throw new Error("Polaris redirect limit exceeded");
  }

  return { getText };
}

function recordUrl(bibId) {
  return `${CATALOG_BASE}/search/title.aspx?ctx=${CATALOG_CONTEXT}&pos=1&cn=${encodeURIComponent(bibId)}`;
}

async function findBestBib(session, { title, author }) {
  async function search(term, by) {
    const params = new URLSearchParams({
      by,
      ctx: CATALOG_CONTEXT,
      limit: PRINT_FILTER,
      page: "0",
      query: "",
      searchid: "1",
      sort: "RELEVANCE",
      term,
      type: "Keyword",
    });
    await session.getText(`${CATALOG_BASE}/search/searchresults.aspx?${params}`);
    const resultsHtml = await session.getText(`${CATALOG_BASE}/search/components/ajaxResults.aspx?page=1`);
    return parseSearchResults(resultsHtml, title, author)[0];
  }

  let best = await search(title, "TI");
  if ((!best || best.score < 0.72) && author) {
    best = await search(`${title} ${author}`, "KW");
  }
  if (!best || best.score < 0.72) return null;
  return {
    ...best,
    confidence: best.score >= 0.88 ? "high" : "verify",
  };
}

async function fetchAvailability(session, match, branchName) {
  const params = new URLSearchParams({
    fp: "1",
    level: "local",
    morelink: "0",
    pos: String(match.pos),
    bibid: match.bibId,
    displayAeonOnly: "0",
  });
  const html = await session.getText(`${CATALOG_BASE}/search/components/ajaxavailability.aspx?${params}`);
  return parseAvailability(html, branchName);
}

// Logged-out, read-only Polaris HTML adapter. Each title gets an isolated
// anonymous catalog session; no patron data, login, hold, or write endpoint.
export async function checkPolarisBookAvailability(book, branchName) {
  const input = book.input || book.title;
  try {
    const session = createAnonymousSession();
    const match = await findBestBib(session, book);
    if (!match) return notFound(input);
    const availability = await fetchAvailability(session, match, branchName);
    return {
      input,
      matchedTitle: match.title,
      author: match.author,
      confidence: match.confidence,
      status: availability.status,
      callNumber: availability.callNumber,
      dueDate: availability.dueDate,
      otherBranchCount: availability.otherBranchCount,
      isDigital: false,
      recordUrl: recordUrl(match.bibId),
      coverUrl: match.coverUrl,
      source: "dekalb-polaris-public",
    };
  } catch (error) {
    return unavailable(input, error);
  }
}

function notFound(input) {
  return {
    input, matchedTitle: null, author: null, confidence: null, status: "not_found",
    callNumber: null, dueDate: null, otherBranchCount: 0, isDigital: false,
    recordUrl: null, coverUrl: null, source: "dekalb-polaris-public",
  };
}

function unavailable(input, error) {
  console.error("Polaris availability lookup failed", error instanceof Error ? error.message : error);
  return {
    ...notFound(input),
    status: "unavailable",
    errorCode: "provider_unavailable",
  };
}
