import { jaccardSimilarity, authorMatches } from "./text";

const LIBRARY = "fulcolibrary";
const BASE = `https://gateway.bibliocommons.com/v2/libraries/${LIBRARY}`;
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

async function bcFetch(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`BiblioCommons request failed: ${res.status}`);
  return res.json();
}

function isPhysicalBook(bib) {
  const superFormats = bib?.briefInfo?.superFormats || [];
  return (
    superFormats.includes("BOOKS") &&
    !superFormats.includes("ELECTRONIC_FORMATS") &&
    !superFormats.includes("AUDIOBOOKS_SPOKEN_WORD") &&
    !superFormats.includes("TALKING_BOOKS")
  );
}

// Escape parens/quotes that would break the boolean query syntax.
function blTerm(str) {
  return str.replace(/[():"]/g, " ").replace(/\s+/g, " ").trim();
}

async function searchBibs(searchType, query) {
  const url = `${BASE}/bibs/search?searchType=${searchType}&query=${encodeURIComponent(query)}`;
  try {
    const data = await bcFetch(url);
    return Object.values(data?.entities?.bibs || {});
  } catch {
    return [];
  }
}

// Search the catalog and pick the best physical-book match for {title, author}.
// First pass: field-scoped boolean query (precise). Fallback: smart keyword search
// (handles typos and titles the bl parser rejects).
async function matchBook({ title, author }) {
  let bibs = [];
  const scoped = author
    ? `title:(${blTerm(title)}) author:(${blTerm(author)}) formatcode:(BK OR PAPERBACK OR LPRINT)`
    : `title:(${blTerm(title)}) formatcode:(BK OR PAPERBACK OR LPRINT)`;
  bibs = await searchBibs("bl", scoped);

  if (bibs.length === 0) {
    bibs = await searchBibs("smart", author ? `${title} ${author}` : title);
  }

  const candidates = bibs.filter(isPhysicalBook);

  let best = null;
  let bestScore = 0;
  let bestAuthorMatch = false;

  for (const bib of candidates) {
    const bibTitle = bib.briefInfo?.title || "";
    const score = jaccardSimilarity(title, bibTitle);
    if (score < 0.5) continue;

    const bibAuthors = bib.briefInfo?.authors || [];
    const matchedAuthor = author ? authorMatches(author, bibAuthors) : false;

    // Prefer author-matched candidates, then highest title score.
    const better =
      !best ||
      (matchedAuthor && !bestAuthorMatch) ||
      (matchedAuthor === bestAuthorMatch && score > bestScore);

    if (better) {
      best = bib;
      bestScore = score;
      bestAuthorMatch = matchedAuthor;
    }
  }

  if (!best) return null;

  const confidence = !author ? "high" : bestAuthorMatch ? "high" : "verify";

  return {
    bibId: best.briefInfo?.id || best.id,
    matchedTitle: best.briefInfo?.title || title,
    author: (best.briefInfo?.authors || []).join(", "),
    confidence,
    coverUrl: best.briefInfo?.jacket?.medium || best.briefInfo?.jacket?.small || null,
  };
}

async function fetchAvailability(bibId, branchCode) {
  const url = `${BASE}/bibs/${bibId}/availability`;
  const data = await bcFetch(url);
  const items = Object.values(data?.entities?.bibItems || {});

  const itemsAtBranch = items.filter((item) => item.branch?.code === branchCode);
  const availableAtBranch = itemsAtBranch.filter(
    (item) => item.availability?.status === "AVAILABLE"
  );

  const otherAvailableBranches = new Set(
    items
      .filter(
        (item) =>
          item.availability?.status === "AVAILABLE" && item.branch?.code !== branchCode
      )
      .map((item) => item.branch?.code)
  );

  if (availableAtBranch.length > 0) {
    const item = availableAtBranch[0];
    return {
      status: "on_shelf",
      callNumber: item.callNumber || null,
      dueDate: null,
      otherBranchCount: otherAvailableBranches.size,
    };
  }

  if (itemsAtBranch.length > 0) {
    const withDueDate = itemsAtBranch
      .filter((item) => item.dueDate)
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
    const item = withDueDate[0] || itemsAtBranch[0];
    return {
      status: "checked_out",
      callNumber: item.callNumber || null,
      dueDate: item.dueDate || null,
      otherBranchCount: otherAvailableBranches.size,
    };
  }

  return {
    status: otherAvailableBranches.size > 0 ? "elsewhere" : "checked_out",
    callNumber: null,
    dueDate: null,
    otherBranchCount: otherAvailableBranches.size,
  };
}

// Full pipeline for one book: search -> match -> availability.
export async function checkBookAvailability(book, branchCode) {
  const input = book.title;
  const match = await matchBook(book);

  if (!match) {
    return {
      input,
      matchedTitle: null,
      author: null,
      confidence: null,
      status: "not_found",
      callNumber: null,
      dueDate: null,
      otherBranchCount: 0,
      recordUrl: null,
      coverUrl: null,
    };
  }

  let availability;
  try {
    availability = await fetchAvailability(match.bibId, branchCode);
  } catch {
    availability = {
      status: "not_found",
      callNumber: null,
      dueDate: null,
      otherBranchCount: 0,
    };
  }

  return {
    input,
    matchedTitle: match.matchedTitle,
    author: match.author,
    confidence: match.confidence,
    status: availability.status,
    callNumber: availability.callNumber,
    dueDate: availability.dueDate,
    otherBranchCount: availability.otherBranchCount,
    recordUrl: `https://fulcolibrary.bibliocommons.com/v2/record/${match.bibId}`,
    coverUrl: match.coverUrl,
  };
}
