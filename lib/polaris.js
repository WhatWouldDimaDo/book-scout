import { parseAvailability, parseSearchResults } from "./polaris-parser.mjs";

const CATALOG_BASE = "https://dekalb.polarislibrary.com/polaris";
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
  let text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new Error("Polaris response exceeds size limit");
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

async function polarisFetch(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html, */*;q=0.8" },
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Polaris request failed: ${response.status}`);
    return await readLimitedText(response);
  } finally {
    clearTimeout(timer);
  }
}

function recordUrl(bibId) {
  return `${CATALOG_BASE}/search/title.aspx?ctx=22.1033.0.0.6&pos=1&cn=${encodeURIComponent(bibId)}`;
}

async function findBestBib({ title, author }) {
  const term = author ? `${title} ${author}` : title;
  const params = new URLSearchParams({
    by: "TI", ctx: "22.1033.0.0.6", limit: "TOM=*", page: "0", query: "",
    searchid: "1", sort: "RELEVANCE", term, type: "Keyword",
  });
  const html = await polarisFetch(`${CATALOG_BASE}/search/searchresults.aspx?${params}`);
  const candidates = parseSearchResults(html, title);
  const best = candidates[0];
  if (!best || best.score < 0.25) return null;
  return {
    bibId: best.bibId,
    matchedTitle: title,
    author: author || null,
    confidence: best.score >= 0.6 ? "high" : "verify",
    score: best.score,
  };
}

async function fetchAvailability(bibId, branchName) {
  const params = new URLSearchParams({
    level: "local", pos: "1", morelink: "0", bibid: bibId,
    requestlevel: "", fp: "1", displayAeonOnly: "0",
  });
  const html = await polarisFetch(`${CATALOG_BASE}/search/components/ajaxavailability.aspx?${params}`);
  return parseAvailability(html, branchName);
}

// Public, logged-out Polaris HTML proof of concept. This does not call PAPI, access
// patron data, create holds, or make any write request to the catalog.
export async function checkPolarisBookAvailability(book, branchName) {
  const input = book.input || book.title;
  try {
    const match = await findBestBib(book);
    if (!match) return notFound(input);
    const availability = await fetchAvailability(match.bibId, branchName);
    return {
      input,
      matchedTitle: match.matchedTitle,
      author: match.author,
      confidence: match.confidence,
      status: availability.status,
      callNumber: availability.callNumber,
      dueDate: null,
      otherBranchCount: availability.otherBranchCount,
      isDigital: false,
      recordUrl: recordUrl(match.bibId),
      coverUrl: null,
    };
  } catch {
    // Preserve per-title failure isolation: a timeout/malformed catalog response
    // should never fail a whole pasted list.
    return notFound(input);
  }
}

function notFound(input) {
  return {
    input, matchedTitle: null, author: null, confidence: null, status: "not_found",
    callNumber: null, dueDate: null, otherBranchCount: 0, isDigital: false,
    recordUrl: null, coverUrl: null,
  };
}
