import { NextResponse } from "next/server";
import { checkBookAvailability } from "@/lib/bibliocommons";
import { mapWithConcurrency } from "@/lib/concurrency";

const MAX_BOOKS = 25;
const CONCURRENCY = 4;

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { books, branch } = body || {};

  if (!Array.isArray(books) || books.length === 0) {
    return NextResponse.json({ error: "books must be a non-empty array" }, { status: 400 });
  }
  if (!branch || typeof branch !== "string") {
    return NextResponse.json({ error: "branch is required" }, { status: 400 });
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

  const results = await mapWithConcurrency(validBooks, CONCURRENCY, (book) =>
    checkBookAvailability(book, branch)
  );

  return NextResponse.json({ results });
}
