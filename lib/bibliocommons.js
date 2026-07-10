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

// Verified live against the Fulton gateway 2026-07-10: ebooks carry
// briefInfo.format "EBOOK" + superFormats ["BOOKS","ELECTRONIC_FORMATS"];
// audiobooks carry "AB" + ["AUDIOBOOKS_SPOKEN_WORD","ELECTRONIC_FORMATS","TALKING_BOOKS"].
function matchesFormat(bib, format) {
  const superFormats = bib?.briefInfo?.superFormats || [];
  const fmt = bib?.briefInfo?.format;
  if (format === "ebook") {
    return fmt === "EBOOK" || (superFormats.includes("ELECTRONIC_FORMATS") && superFormats.includes("BOOKS"));
  }
  if (format === "audiobook") {
    return fmt === "AB" || superFormats.includes("AUDIOBOOKS_SPOKEN_WORD");
  }
  return isPhysicalBook(bib);
}

function formatCodeClause(format) {
  if (format === "ebook") return "formatcode:(EBOOK)";
  if (format === "audiobook") return "formatcode:(AB)";
  return "formatcode:(BK OR PAPERBACK OR LPRINT)";
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
async function matchBook({ title, author }, format = "print") {
  let bibs = [];
  const clause = formatCodeClause(format);
  const scoped = author
    ? `title:(${blTerm(title)}) author:(${blTerm(author)}) ${clause}`
    : `title:(${blTerm(title)}) ${clause}`;
  bibs = await searchBibs("bl", scoped);

  if (bibs.length === 0) {
    bibs = await searchBibs("smart", author ? `${title} ${author}` : title);
  }

  const candidates = bibs.filter((bib) => matchesFormat(bib, format));

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

// Digital items (ebook/audiobook) aren't branch-scoped — the gateway always reports
// them under a placeholder "CENTRAL" branch regardless of the item's actual home
// library. Verified live 2026-07-10: entities.availabilities.{id} carries a
// system-wide aggregate (status/heldCopies/availableCopies/totalCopies) that's a
// more reliable signal than per-item branch filtering.
function digitalAvailability(data) {
  const availEntity = Object.values(data?.entities?.availabilities || {})[0];
  const items = Object.values(data?.entities?.bibItems || {});

  if (availEntity) {
    const isAvailable = availEntity.status === "AVAILABLE" || availEntity.availableCopies > 0;
    const hasCopies = (availEntity.totalCopies ?? items.length) > 0;
    return {
      status: isAvailable ? "on_shelf" : hasCopies ? "checked_out" : "not_found",
      callNumber: null,
      dueDate: null,
      otherBranchCount: 0,
      isDigital: true,
    };
  }

  const anyAvailable = items.some((item) => item.availability?.status === "AVAILABLE");
  return {
    status: anyAvailable ? "on_shelf" : items.length > 0 ? "checked_out" : "not_found",
    callNumber: null,
    dueDate: null,
    otherBranchCount: 0,
    isDigital: true,
  };
}

async function fetchAvailability(bibId, branchCode, format = "print") {
  const url = `${BASE}/bibs/${bibId}/availability`;
  const data = await bcFetch(url);

  if (format !== "print") {
    return digitalAvailability(data);
  }

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
      isDigital: false,
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
      isDigital: false,
    };
  }

  return {
    status: otherAvailableBranches.size > 0 ? "elsewhere" : "checked_out",
    callNumber: null,
    dueDate: null,
    otherBranchCount: otherAvailableBranches.size,
    isDigital: false,
  };
}

// Full pipeline for one book: search -> match -> availability.
export async function checkBookAvailability(book, branchCode, format = "print") {
  const input = book.title;
  const match = await matchBook(book, format);

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
      isDigital: format !== "print",
      recordUrl: null,
      coverUrl: null,
    };
  }

  let availability;
  try {
    availability = await fetchAvailability(match.bibId, branchCode, format);
  } catch {
    availability = {
      status: "not_found",
      callNumber: null,
      dueDate: null,
      otherBranchCount: 0,
      isDigital: format !== "print",
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
    isDigital: availability.isDigital,
    recordUrl: `https://fulcolibrary.bibliocommons.com/v2/record/${match.bibId}`,
    coverUrl: match.coverUrl,
  };
}
