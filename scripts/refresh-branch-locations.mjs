import { readFile, writeFile } from "node:fs/promises";

const FULTON_BASE = "https://www.fulcolibrary.org";
const DEKALB_BASE = "https://dekalblibrary.org";
const HEADERS = {
  "User-Agent": "Dewey branch-location data refresh (contact: hello@dimadimadima.com)",
  Accept: "text/html",
};

async function fetchText(url) {
  const response = await fetch(url, { headers: HEADERS });
  if (!response.ok) throw new Error(`${response.status} from ${url}`);
  return response.text();
}

async function mapWithConcurrency(items, limit, mapper) {
  const output = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      output[index] = await mapper(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return output;
}

function decodeHtml(value) {
  return String(value || "")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#8211;|&ndash;/gi, "–")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizedName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/joan p\. garner|gladys s\. dennard|louise watley|william c\. brown|avis g\. williams|barbara loar|william reid h\. cofer|sue kellogg/g, "")
    .replace(/library|branch|homework center|at southeast atlanta|at south fulton/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function firstJsonLdLibrary(html, url) {
  for (const match of html.matchAll(/<script\b[^>]*type=['"]application\/ld\+json['"][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const value = JSON.parse(match[1]);
      const candidates = Array.isArray(value?.["@graph"]) ? value["@graph"] : [value];
      const library = candidates.find((item) => item?.["@type"] === "Library" && item.address && item.geo);
      if (library) return library;
    } catch {
      // Ignore unrelated malformed metadata blocks.
    }
  }
  throw new Error(`No library location metadata at ${url}`);
}

async function buildFultonLocations() {
  const branches = JSON.parse(await readFile(new URL("../data/branches.json", import.meta.url), "utf8"));
  return mapWithConcurrency(branches, 4, async (branch) => {
    const sourceUrl = `${FULTON_BASE}/locations/${encodeURIComponent(branch.code)}/`;
    const metadata = firstJsonLdLibrary(await fetchText(sourceUrl), sourceUrl);
    return {
      library: "fulcolibrary",
      systemName: "Fulton County",
      code: branch.code,
      name: branch.name,
      street: metadata.address.streetAddress,
      city: metadata.address.addressLocality,
      state: metadata.address.addressRegion,
      postalCode: metadata.address.postalCode,
      latitude: Number(metadata.geo.latitude),
      longitude: Number(metadata.geo.longitude),
      sourceUrl,
    };
  });
}

function parseDekalbCards(html) {
  const cards = html.match(/<div class="card h-100 branch">[\s\S]*?<div align="center">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/gi) || [];
  return cards.map((card) => {
    const link = card.match(/<h2[^>]*>[\s\S]*?<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    const address = card.match(/<\/h2>\s*([^<][\s\S]*?)<br\s*\/?>\s*([^,<]+),\s*([A-Z]{2})\s*(?:&nbsp;|&#160;)?\s*(\d{5})<br/i);
    if (!link || !address) return null;
    return {
      sourceUrl: new URL(link[1], DEKALB_BASE).toString(),
      officialName: decodeHtml(link[2]),
      street: decodeHtml(address[1]),
      city: decodeHtml(address[2]),
      state: address[3],
      postalCode: address[4],
    };
  }).filter(Boolean);
}

async function dekalbCoordinates(sourceUrl) {
  const html = await fetchText(sourceUrl);
  const mapUrl = html.match(/<iframe[^>]*title="Interactive map[^"]*"[^>]*src="([^"]+)"/i)?.[1];
  if (!mapUrl) throw new Error(`No official branch map at ${sourceUrl}`);
  const mapHtml = await fetchText(decodeHtml(mapUrl));
  const coordinates = mapHtml.match(/&quot;coordinates&quot;:\s*\[(-?\d+\.\d+),\s*(-?\d+\.\d+)\]/i);
  if (!coordinates) throw new Error(`No map coordinates at ${mapUrl}`);
  return { longitude: Number(coordinates[1]), latitude: Number(coordinates[2]) };
}

async function buildDekalbLocations() {
  const branches = JSON.parse(await readFile(new URL("../data/dekalbBranches.json", import.meta.url), "utf8"));
  const cards = parseDekalbCards(await fetchText(`${DEKALB_BASE}/locations/`));
  return mapWithConcurrency(branches, 3, async (branch) => {
    const wanted = normalizedName(branch.name);
    const card = cards.find((candidate) => {
      const actual = normalizedName(candidate.officialName);
      return actual === wanted || actual.includes(wanted) || wanted.includes(actual);
    });
    if (!card) throw new Error(`No official location card matched ${branch.name}`);
    const coordinates = await dekalbCoordinates(card.sourceUrl);
    return {
      library: "dekalb",
      systemName: "DeKalb County",
      code: branch.code,
      name: branch.name,
      street: card.street,
      city: card.city,
      state: card.state,
      postalCode: card.postalCode,
      ...coordinates,
      sourceUrl: card.sourceUrl,
      beta: true,
    };
  });
}

const locations = [
  ...(await buildFultonLocations()),
  ...(await buildDekalbLocations()),
  ...JSON.parse(await readFile(new URL("../data/additionalBranchLocations.json", import.meta.url), "utf8")),
].sort((a, b) => a.systemName.localeCompare(b.systemName) || a.name.localeCompare(b.name));

await writeFile(
  new URL("../data/branchLocations.json", import.meta.url),
  `${JSON.stringify(locations, null, 2)}\n`,
);

console.log(`Wrote ${locations.length} official branch locations.`);
