function normalizeWords(str) {
  return String(str || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function jaccardSimilarity(a, b) {
  const first = new Set(normalizeWords(a));
  const second = new Set(normalizeWords(b));
  if (!first.size || !second.size) return 0;
  let intersection = 0;
  for (const word of first) if (second.has(word)) intersection++;
  return intersection / new Set([...first, ...second]).size;
}

function decodeHtml(value) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (_match, code) =>
      String.fromCodePoint(code.startsWith("x") ? Number.parseInt(code.slice(1), 16) : Number(code))
    );
}

export function htmlToText(html) {
  return decodeHtml(String(html || "")
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim());
}

// Polaris' public markup has changed over time, but its search results consistently
// include a numeric bibid in links or availability controls. Keep this parser tolerant
// of class-name changes; title matching selects among the public result snippets.
export function parseSearchResults(html, query) {
  const source = String(html || "");
  const matches = [...source.matchAll(/(?:\bbibid\b|\bbibId\b|\bbib_id\b)\s*(?:=|:|%3D)\s*["']?(\d+)/gi)];
  const seen = new Set();
  const candidates = matches.map((match) => {
    const bibId = match[1];
    if (seen.has(bibId)) return null;
    seen.add(bibId);
    const start = Math.max(0, match.index - 2200);
    const end = Math.min(source.length, match.index + 2200);
    const context = htmlToText(source.slice(start, end));
    return { bibId, context, score: jaccardSimilarity(query, context) };
  }).filter(Boolean);

  // A direct title search can yield a result link with the bib id only in a URL-encoded
  // parameter. Accept that form as a fallback.
  if (candidates.length === 0) {
    for (const match of source.matchAll(/(?:bibid|bibId|bib_id)(?:%3D|=)(\d+)/gi)) {
      if (!seen.has(match[1])) {
        seen.add(match[1]);
        candidates.push({ bibId: match[1], context: htmlToText(source), score: jaccardSimilarity(query, htmlToText(source)) });
      }
    }
  }

  return candidates.sort((a, b) => b.score - a.score);
}

function statusFor(text) {
  const value = text.toLowerCase();
  if (/checked\s+in|\bon\s+shelf\b|\bavailable\b/.test(value) && !/not\s+available/.test(value)) return "on_shelf";
  if (/checked\s+out|due\s+back|on\s+loan|in\s+transit|on\s+hold/.test(value)) return "checked_out";
  return null;
}

function branchMatches(text, branchName) {
  const wanted = normalizeWords(branchName);
  const actual = new Set(normalizeWords(text));
  return wanted.length > 0 && wanted.every((word) => actual.has(word));
}

export function parseAvailability(html, branchName) {
  const source = String(html || "");
  const blocks = source.match(/<(?:tr|li|div)\b[^>]*>[\s\S]*?<\/(?:tr|li|div)>/gi) || [];
  const rows = blocks.map(htmlToText).filter((row) => row.length > 0);
  const matching = rows.filter((row) => branchMatches(row, branchName));
  const branchRows = matching.length ? matching : rows;

  const onShelf = branchRows.find((row) => statusFor(row) === "on_shelf");
  const checkedOut = branchRows.find((row) => statusFor(row) === "checked_out");
  const selected = onShelf || checkedOut;
  const allStatuses = rows.map(statusFor).filter(Boolean);
  const otherBranchCount = Math.max(0, allStatuses.filter((status) => status === "on_shelf").length - (onShelf ? 1 : 0));

  // Polaris puts the call number next to the branch/status. This intentionally keeps
  // the original punctuation rather than guessing a classification from title text.
  const callMatch = selected?.match(/(?:call\s*(?:no\.?|number)\s*:?\s*)?([A-Z]{1,4}\s*\d{1,3}(?:\.\d+)?(?:\s+[A-Z0-9.'-]+){0,5})/i);
  const callNumber = callMatch?.[1]
    ?.replace(/\s+(?:checked\s+in|checked\s+out|available|on\s+shelf|due\s+back|on\s+loan|in\s+transit|on\s+hold).*$/i, "")
    .replace(/\s+/g, " ")
    .trim() || null;
  return {
    status: onShelf ? "on_shelf" : checkedOut ? "checked_out" : allStatuses.includes("on_shelf") ? "elsewhere" : "not_found",
    callNumber,
    otherBranchCount,
  };
}
