// Text normalization + fuzzy matching helpers shared by the availability route.

export function normalizeWords(str) {
  if (!str) return [];
  return str
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

// Jaccard similarity of the two word sets, 0..1
export function jaccardSimilarity(a, b) {
  const setA = new Set(normalizeWords(a));
  const setB = new Set(normalizeWords(b));
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const word of setA) {
    if (setB.has(word)) intersection++;
  }
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

// Extract a plausible last name from a free-text author string ("Larry McMurtry" -> "mcmurtry")
export function lastName(authorStr) {
  const words = normalizeWords(authorStr);
  return words.length ? words[words.length - 1] : "";
}

// Does any bib author entry ("McMurtry, Larry") contain the given last name?
export function authorMatches(inputAuthor, bibAuthors) {
  if (!inputAuthor || !bibAuthors || bibAuthors.length === 0) return false;
  const target = lastName(inputAuthor);
  if (!target) return false;
  return bibAuthors.some((a) => normalizeWords(a).includes(target));
}
