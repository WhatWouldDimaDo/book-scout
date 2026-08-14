function decodeHtml(value) {
  return String(value || "")
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

function normalized(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(a|an|the)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokens(value) {
  return normalized(value).split(/\s+/).filter(Boolean);
}

function tokenSimilarity(first, second) {
  const a = new Set(tokens(first));
  const b = new Set(tokens(second));
  if (!a.size || !b.size) return 0;
  let overlap = 0;
  for (const token of a) if (b.has(token)) overlap += 1;
  return overlap / new Set([...a, ...b]).size;
}

function firstMatch(source, expression, group = 1) {
  return source.match(expression)?.[group] || null;
}

function scoreCandidate(candidate, queryTitle, queryAuthor) {
  const wantedTitle = normalized(queryTitle);
  const actualTitle = normalized(candidate.title);
  if (!wantedTitle || !actualTitle) return 0;
  const authorScore = queryAuthor ? tokenSimilarity(queryAuthor, candidate.author) : 0;
  const exactTitle = actualTitle === wantedTitle;

  let score = tokenSimilarity(wantedTitle, actualTitle) * 0.72;
  if (exactTitle) score = 0.9;
  else if (
    actualTitle.startsWith(`${wantedTitle} `) &&
    (tokens(wantedTitle).length >= 2 || (authorScore >= 0.8 && candidate.title.includes(":")))
  ) score = 0.82;
  else if (wantedTitle.startsWith(`${actualTitle} `)) score += 0.08;

  if (queryAuthor) {
    score += authorScore * 0.18;
    // Catalog author forms and LLM-supplied series authors can disagree.
    // Preserve exact-title priority; use author penalties only to reject
    // broader title matches, while still using author similarity to break
    // ties between records with the same exact title.
    if (!exactTitle && candidate.author && authorScore < 0.5) score -= 0.18;
  }
  if (!/^(?:book|large print)$/i.test(candidate.format || "Book")) score -= 0.4;
  return Math.max(0, Math.min(1, score));
}

// ajaxResults.aspx returns one structured result module per search position.
// Parse fields from that module rather than scoring the surrounding page text.
export function parseSearchResults(html, queryTitle, queryAuthor = "") {
  const source = String(html || "");
  const starts = [...source.matchAll(/<div class="search__position">[\s\S]*?id="__pos-(\d+)"[\s\S]*?<\/div>/gi)];
  const candidates = [];

  for (let index = 0; index < starts.length; index += 1) {
    const start = starts[index].index;
    const end = index + 1 < starts.length ? starts[index + 1].index : source.length;
    const block = source.slice(start, end);
    const link = block.match(/<a\b[^>]*class="nsm-brief-action-link"[^>]*href="[^"]*(?:&amp;|&)pos=(\d+)(?:&amp;|&)cn=(\d+)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!link) continue;

    const authorBlock = firstMatch(block, /<div class="nsm-brief-primary-author-group">([\s\S]*?)<\/div>/i);
    const format = decodeHtml(firstMatch(block, /class="c-title-detail-formats__img"[^>]*alt="([^"]+)"/i) || "Book");
    const coverUrl = decodeHtml(firstMatch(block, /class=['"][^'"]*c-title-detail__thumbnail[^'"]*['"][^>]*src="([^"]+)"/i) || "");
    const candidate = {
      pos: Number(link[1]),
      bibId: link[2],
      title: htmlToText(link[3]).replace(/\s*\/\s*$/, ""),
      author: authorBlock ? htmlToText(authorBlock).replace(/^by\s+/i, "").replace(/[.,;:]\s*$/, "") : null,
      format,
      coverUrl: coverUrl || null,
    };
    candidate.score = scoreCandidate(candidate, queryTitle, queryAuthor);
    candidates.push(candidate);
  }

  return candidates.sort((a, b) => b.score - a.score || a.pos - b.pos);
}

function parsePieceRows(block) {
  const rows = block.match(/<tr class="piece">[\s\S]*?<\/tr>/gi) || [];
  return rows.map((row) => {
    const callParam = firstMatch(row, /[?&amp;]callnum=([^&"']*)/i);
    const status = htmlToText(firstMatch(row, /<td class="piece">([\s\S]*?)<\/td>/i) || "");
    const dueDate = firstMatch(status, /Due:\s*([^)]+)/i);
    return {
      callNumber: callParam ? decodeURIComponent(callParam.replace(/\+/g, " ")).trim() : null,
      status,
      dueDate: dueDate || null,
      checkedIn: /checked\s+in/i.test(status),
      checkedOut: /checked\s+out|on\s+hold|in\s+transit/i.test(status),
    };
  });
}

export function parseAvailability(html, branchName) {
  const source = String(html || "");
  if (/POWERPAC-ERROR|session (?:has )?timed out/i.test(source)) {
    throw new Error("Polaris session expired before availability loaded");
  }

  const starts = [...source.matchAll(/<tr class="location">/gi)];
  const locations = starts.map((match, index) => {
    const end = index + 1 < starts.length ? starts[index + 1].index : source.length;
    const block = source.slice(match.index, end);
    const headerEnd = block.indexOf("</tr>");
    const header = headerEnd >= 0 ? block.slice(0, headerEnd + 5) : block;
    const name = htmlToText(firstMatch(header, /<a class="group"[^>]*>([\s\S]*?)<\/a>/i) || "")
      .replace(/^Click to hide details\s*/i, "")
      .trim();
    const counts = header.match(/\((\d+)\s+of\s+(\d+)\s+available\)/i);
    return {
      name,
      available: counts ? Number(counts[1]) : 0,
      total: counts ? Number(counts[2]) : 0,
      pieces: parsePieceRows(block),
    };
  }).filter((location) => location.name);

  const wanted = normalized(branchName);
  const selected = locations.find((location) => normalized(location.name) === wanted);
  const availableBranches = locations
    .filter((location) => location !== selected && location.available > 0)
    .map((location) => {
      const checkedIn = location.pieces.find((piece) => piece.checkedIn);
      return {
        name: location.name,
        available: location.available,
        callNumber: checkedIn?.callNumber || location.pieces[0]?.callNumber || null,
      };
    });
  const otherBranchCount = availableBranches.length;

  if (!selected) {
    return {
      status: locations.length > 0 ? "elsewhere" : "not_found",
      callNumber: null,
      dueDate: null,
      otherBranchCount,
      availableBranches,
      branchFound: false,
    };
  }

  const checkedIn = selected.pieces.find((piece) => piece.checkedIn);
  const checkedOut = selected.pieces.find((piece) => piece.checkedOut);
  const chosen = checkedIn || checkedOut || selected.pieces[0];
  return {
    status: selected.available > 0 ? "on_shelf" : selected.total > 0 ? "checked_out" : otherBranchCount > 0 ? "elsewhere" : "not_found",
    callNumber: chosen?.callNumber || null,
    dueDate: checkedOut?.dueDate || null,
    otherBranchCount,
    availableBranches,
    branchFound: true,
  };
}
