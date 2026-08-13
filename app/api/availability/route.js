import { NextResponse } from "next/server";
import { checkBookAvailability } from "@/lib/bibliocommons";
import { mapWithConcurrency } from "@/lib/concurrency";
import { chatCompletion, extractJsonArray } from "@/lib/llm";
import libraries from "@/data/libraries.json";

const MAX_BOOKS = 25;
const CONCURRENCY = 4;
const FORMATS = ["all", "print", "ebook", "audiobook"];

const NORMALIZE_PROMPT = `You clean up book lists for a library catalog search. Given a JSON array of
{title, author} entries (possibly with typos, partial titles, or missing authors), return ONLY a JSON
array of the same length and order with each entry corrected: fix spelling of real book titles, expand
obvious partial titles, and fill in the author's name when you are confident of the match. Keep the
original value whenever you are not confident it refers to a real published book. Never invent books,
never reorder, never add or drop entries. Raw JSON array only, no prose.`;

// LLM pre-pass: fixes typos/partial titles so exact catalog queries can hit.
// Fails open — any error/timeout returns the original list untouched.
async function normalizeBooks(books) {
  try {
    const { content } = await chatCompletion({
      system: NORMALIZE_PROMPT,
      user: JSON.stringify(books),
      maxTokens: 1500,
      timeoutMs: 12000,
    });
    const fixed = extractJsonArray(content);
    if (!Array.isArray(fixed) || fixed.length !== books.length) return books;
    return books.map((orig, i) => {
      const f = fixed[i];
      if (!f || typeof f.title !== "string" || !f.title.trim()) return orig;
      return {
        title: f.title.trim(),
        author: (typeof f.author === "string" ? f.author : orig.author || "").trim(),
        input: orig.title,
      };
    });
  } catch {
    return books;
  }
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { books, branch, format = "all", library = "fulcolibrary" } = body || {};

  if (!Array.isArray(books) || books.length === 0) {
    return NextResponse.json({ error: "books must be a non-empty array" }, { status: 400 });
  }
  if (!branch || typeof branch !== "string") {
    return NextResponse.json({ error: "branch is required" }, { status: 400 });
  }
  if (!FORMATS.includes(format)) {
    return NextResponse.json({ error: "Invalid format" }, { status: 400 });
  }
  if (!libraries.some((l) => l.slug === library)) {
    return NextResponse.json({ error: "Invalid library" }, { status: 400 });
  }
  if (books.length > MAX_BOOKS) {
    return NextResponse.json(
      { error: `Max ${MAX_BOOKS} books per request` },
      { status: 400 }
    );
  }

  const validBooks = books
    .filter((b) => b && typeof b.title === "string" && b.title.trim().length > 0)
    .map((b) => ({ title: b.title.trim(), author: (b.author || "").trim() }));

  if (validBooks.length === 0) {
    return NextResponse.json({ error: "No valid books provided" }, { status: 400 });
  }

  const normalized = process.env.OPENROUTER_API_KEY
    ? await normalizeBooks(validBooks)
    : validBooks;

  const results = await mapWithConcurrency(normalized, CONCURRENCY, (book) =>
    checkBookAvailability(book, branch, format, library)
  );

  return NextResponse.json({ results });
}
