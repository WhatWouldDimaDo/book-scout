import { parseAvailability, parseSearchResults } from "./polaris-parser.mjs";
import { distanceMiles, normalizeLocationQuery } from "./branchLocator.mjs";

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

export function getPolarisSettings(system) {
  if (system?.provider !== "polaris") throw new Error("Polaris system configuration is required");
  const url = new URL(system.catalogBase);
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
    throw new Error("Polaris catalog base must be a plain HTTPS URL");
  }
  if (!/^\d+(?:\.\d+){4}$/.test(system.catalogContext || "")) {
    throw new Error("Polaris catalog context is invalid");
  }
  return {
    catalogBase: `${url.origin}${url.pathname.replace(/\/+$/, "")}`,
    catalogContext: system.catalogContext,
    source: `${system.slug}-polaris-public`,
  };
}

function recordUrl(settings, bibId, pos) {
  return `${settings.catalogBase}/search/title.aspx?ctx=${settings.catalogContext}&pos=${encodeURIComponent(pos)}&cn=${encodeURIComponent(bibId)}`;
}

export async function findBestBib(session, { title, author }, settings) {
  async function search(term, by, sort = "RELEVANCE") {
    const params = new URLSearchParams({
      by,
      ctx: settings.catalogContext,
      limit: PRINT_FILTER,
      page: "0",
      query: "",
      searchid: "1",
      sort,
      term,
      type: "Keyword",
    });
    await session.getText(`${settings.catalogBase}/search/searchresults.aspx?${params}`);
    const resultsParams = new URLSearchParams({ page: "1", sort });
    const resultsHtml = await session.getText(`${settings.catalogBase}/search/components/ajaxResults.aspx?${resultsParams}`);
    return parseSearchResults(resultsHtml, title, author)[0];
  }

  let best = await search(title, "TI");
  if (!best || best.score < 0.88) {
    const titleSorted = await search(title, "TI", "TI");
    // Sorting mutates Polaris's anonymous search session and therefore its
    // position numbers. Prefer the candidate from the latest result set when
    // scores tie so the subsequent holdings request uses a current position.
    if (!best || (titleSorted && titleSorted.score >= best.score)) best = titleSorted;
  }
  if ((!best || best.score < 0.72) && author) {
    best = await search(`${title} ${author}`, "KW");
  }
  if (!best || best.score < 0.72) return null;
  return {
    ...best,
    confidence: best.score >= 0.88 ? "high" : "verify",
  };
}

export function rankNearbyAvailableBranches(branchName, availableBranches, branchLocations, limit = 2) {
  if (!Array.isArray(availableBranches) || availableBranches.length === 0) return [];
  const locations = Array.isArray(branchLocations) ? branchLocations : [];
  const homeKey = normalizeLocationQuery(branchName);
  const home = locations.find((location) =>
    normalizeLocationQuery(location.code) === homeKey || normalizeLocationQuery(location.name) === homeKey
  );
  const locationByName = new Map(
    locations.map((location) => [normalizeLocationQuery(location.name), location]),
  );

  return availableBranches
    .map((branch) => {
      const location = locationByName.get(normalizeLocationQuery(branch.name));
      const distance = home && location ? distanceMiles(home, location) : null;
      return {
        ...branch,
        distanceMiles: distance,
      };
    })
    .sort((first, second) => {
      const firstDistance = first.distanceMiles ?? Number.POSITIVE_INFINITY;
      const secondDistance = second.distanceMiles ?? Number.POSITIVE_INFINITY;
      return firstDistance - secondDistance || first.name.localeCompare(second.name);
    })
    .slice(0, limit)
    .map((branch) => ({
      ...branch,
      distanceMiles: branch.distanceMiles == null ? null : Number(branch.distanceMiles.toFixed(1)),
    }));
}

export async function fetchAvailability(session, match, branchName, settings) {
  const params = new URLSearchParams({
    fp: "1",
    level: "local",
    morelink: "0",
    pos: String(match.pos),
    bibid: match.bibId,
    displayAeonOnly: "0",
  });
  const html = await session.getText(`${settings.catalogBase}/search/components/ajaxavailability.aspx?${params}`);
  return parseAvailability(html, branchName);
}

// Logged-out, read-only Polaris HTML adapter. Each title gets an isolated
// anonymous catalog session; no patron data, login, hold, or write endpoint.
export async function checkPolarisBookAvailability(book, branchName, branchLocations = [], system) {
  const input = book.input || book.title;
  let settings;
  try {
    settings = getPolarisSettings(system);
    const session = createAnonymousSession();
    const match = await findBestBib(session, book, settings);
    if (!match) return notFound(input, settings.source);
    const availability = await fetchAvailability(session, match, branchName, settings);
    return {
      input,
      matchedTitle: match.title,
      author: match.author,
      confidence: match.confidence,
      status: availability.status,
      callNumber: availability.callNumber,
      dueDate: availability.dueDate,
      otherBranchCount: availability.otherBranchCount,
      nearbyBranches: rankNearbyAvailableBranches(
        branchName,
        availability.availableBranches,
        branchLocations,
      ),
      isDigital: false,
      recordUrl: recordUrl(settings, match.bibId, match.pos),
      coverUrl: match.coverUrl,
      source: settings.source,
    };
  } catch (error) {
    return unavailable(input, error, settings?.source || "polaris-public");
  }
}

function notFound(input, source) {
  return {
    input, matchedTitle: null, author: null, confidence: null, status: "not_found",
    callNumber: null, dueDate: null, otherBranchCount: 0, nearbyBranches: [], isDigital: false,
    recordUrl: null, coverUrl: null, source,
  };
}

function unavailable(input, error, source) {
  console.error("Polaris availability lookup failed", error instanceof Error ? error.message : error);
  return {
    ...notFound(input, source),
    status: "unavailable",
    errorCode: "provider_unavailable",
  };
}
