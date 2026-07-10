import { NextResponse } from "next/server";
import { mapWithConcurrency } from "@/lib/concurrency";
import { jaccardSimilarity } from "@/lib/text";

const MAX_BOOKS = 30;
const CONCURRENCY = 4;

// Google Books volumes search — no API key required for this volume.
// Query syntax uses literal "+" as an AND separator between field terms, so we
// encode each term individually and join with "+" rather than encoding the whole
// query string (encodeURIComponent would turn "+" into "%2B" and break the syntax).
async function fetchPrice({ title, author }) {
  const empty = { title, author, price: null, currency: null, googleId: null };
  const titleTerm = encodeURIComponent(`intitle:"${title}"`);
  const authorTerm = author ? `+${encodeURIComponent(`inauthor:"${author}"`)}` : "";
  const url = `https://www.googleapis.com/books/v1/volumes?q=${titleTerm}${authorTerm}&country=US&maxResults=3`;

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return empty; // includes 429 — degrade gracefully, don't fail the batch

    const data = await res.json();
    const items = data.items || [];
    if (items.length === 0) return empty;

    let best = items[0];
    let bestScore = -1;
    for (const item of items) {
      const score = jaccardSimilarity(title, item.volumeInfo?.title || "");
      if (score > bestScore) {
        best = item;
        bestScore = score;
      }
    }

    const saleInfo = best.saleInfo || {};
    const priceInfo = saleInfo.listPrice || saleInfo.retailPrice || null;

    return {
      title,
      author,
      price: priceInfo?.amount ?? null,
      currency: priceInfo?.currencyCode ?? null,
      googleId: best.id || null,
    };
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
