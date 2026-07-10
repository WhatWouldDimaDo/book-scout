import { NextResponse } from "next/server";
import { mapWithConcurrency } from "@/lib/concurrency";
import { jaccardSimilarity } from "@/lib/text";

const MAX_BOOKS = 30;
const CONCURRENCY = 4;

// Primary: iTunes Search API (keyless, works from datacenter IPs — Apple Books prices).
// Fallback: Google Books (quota-blocks keyless datacenter IPs, incl. Vercel — kept for
// environments where it works).
async function fetchItunesPrice({ title, author }) {
  const term = encodeURIComponent(`${title} ${author}`.trim());
  const url = `https://itunes.apple.com/search?term=${term}&media=ebook&limit=5&country=US`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;
  const data = await res.json();
  let best = null;
  let bestScore = 0.4;
  for (const r of data.results || []) {
    const score = jaccardSimilarity(title, r.trackName || "");
    if (score > bestScore) {
      best = r;
      bestScore = score;
    }
  }
  if (!best || typeof best.price !== "number") return null;
  return { price: best.price, currency: best.currency || "USD", googleId: null };
}

async function fetchGooglePrice({ title, author }) {
  // Query syntax uses literal "+" as an AND separator between field terms.
  const titleTerm = encodeURIComponent(`intitle:"${title}"`);
  const authorTerm = author ? `+${encodeURIComponent(`inauthor:"${author}"`)}` : "";
  const url = `https://www.googleapis.com/books/v1/volumes?q=${titleTerm}${authorTerm}&country=US&maxResults=3`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;
  const data = await res.json();
  const items = data.items || [];
  if (items.length === 0) return null;
  let best = items[0];
  let bestScore = -1;
  for (const item of items) {
    const score = jaccardSimilarity(title, item.volumeInfo?.title || "");
    if (score > bestScore) {
      best = item;
      bestScore = score;
    }
  }
  const priceInfo = best.saleInfo?.listPrice || best.saleInfo?.retailPrice || null;
  if (!priceInfo?.amount) return null;
  return { price: priceInfo.amount, currency: priceInfo.currencyCode || "USD", googleId: best.id || null };
}

async function fetchPrice({ title, author }) {
  const empty = { title, author, price: null, currency: null, googleId: null };
  try {
    const hit = (await fetchItunesPrice({ title, author })) || (await fetchGooglePrice({ title, author }));
    return hit ? { title, author, ...hit } : empty;
  } catch {
    return empty;
  }
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { books } = body || {};

  if (!Array.isArray(books) || books.length === 0) {
    return NextResponse.json({ error: "books must be a non-empty array" }, { status: 400 });
  }
  if (books.length > MAX_BOOKS) {
    return NextResponse.json({ error: `Max ${MAX_BOOKS} books per request` }, { status: 400 });
  }

  const validBooks = books
    .filter((b) => b && typeof b.title === "string" && b.title.trim().length > 0)
    .map((b) => ({ title: b.title.trim(), author: (b.author || "").trim() }));

  if (validBooks.length === 0) {
    return NextResponse.json({ error: "No valid books provided" }, { status: 400 });
  }

  const results = await mapWithConcurrency(validBooks, CONCURRENCY, fetchPrice);
  return NextResponse.json({ results });
}
