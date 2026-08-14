import { NextResponse } from "next/server";
import libraries from "@/data/libraries.json";
import branchesFallback from "@/data/branches.json";
import dekalbBranches from "@/data/dekalbBranches.json";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

// Module-level cache, keyed by library slug. Survives across requests in the
// same server process; cold on redeploy (same tradeoff as lib/rateLimit.js).
const cache = new Map();

function isValidLibrary(slug) {
  return libraries.some((l) => l.slug === slug);
}

// Branch codes aren't exposed as a dedicated endpoint on the gateway — they
// ride along as facet counts on any search. Pick a query with broad hits
// across the whole system so every branch shows up in the STATUS facet.
async function fetchBranches(library) {
  const url = `https://gateway.bibliocommons.com/v2/libraries/${library}/bibs/search?searchType=smart&query=harry%20potter&limit=1`;
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`branch fetch failed: ${res.status}`);
  const data = await res.json();

  const fields = data?.catalogSearch?.fields || [];
  const statusField = fields.find((f) => f.id === "STATUS");
  const fieldFilters = statusField?.fieldFilters || [];

  const branches = fieldFilters
    .filter((f) => f.value && !f.value.startsWith("_"))
    .map((f) => ({ code: f.value, label: f.label || f.value }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return branches;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const library = searchParams.get("library") || "fulcolibrary";

  if (!isValidLibrary(library)) {
    return NextResponse.json({ error: "Unknown library system" }, { status: 400 });
  }

  // Fast path: Fulton's branch list is static and already verified.
  if (library === "fulcolibrary") {
    return NextResponse.json({
      branches: branchesFallback.map((b) => ({ code: b.code, label: b.name })),
    });
  }
  if (library === "dekalb-polaris") {
    return NextResponse.json({
      branches: dekalbBranches.map((b) => ({ code: b.code, label: b.name })),
    });
  }

  const cached = cache.get(library);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return NextResponse.json({ branches: cached.branches });
  }

  try {
    const branches = await fetchBranches(library);
    if (branches.length === 0) throw new Error("no branches in facet");
    cache.set(library, { branches, fetchedAt: Date.now() });
    return NextResponse.json({ branches });
  } catch (err) {
    if (cached) {
      // Serve stale data over a hard failure.
      return NextResponse.json({ branches: cached.branches });
    }
    return NextResponse.json({ error: "Could not load branches" }, { status: 502 });
  }
}
