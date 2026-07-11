import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rateLimit";
import { chatCompletion, extractJsonArray } from "@/lib/llm";

const MAX_PROMPT_LENGTH = 500;

const SYSTEM_PROMPT = `You are Book Scout's recommendation engine. You ONLY discuss and recommend books.
If the user's request is not about books or reading preferences, politely refuse and ask them to
describe what kind of books they enjoy instead.

When given a valid request, respond with ONLY a JSON array of exactly 8 book recommendations,
no prose before or after. Each item must be an object with exactly these keys:
"title" (string), "author" (string), "year" (string or number), "oneLiner" (a punchy one-sentence
description, max ~20 words). Do not recommend the same book twice. Do not wrap the array in an
object or add markdown formatting — return the raw JSON array only.`;

function getClientIp(request) {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "unknown";
}

export async function POST(request) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "Recommendations aren't configured yet — ask the site owner to add an OpenRouter API key.",
      },
      { status: 503 }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const prompt = (body?.prompt || "").trim();
  if (!prompt) {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  }
  if (prompt.length > MAX_PROMPT_LENGTH) {
    return NextResponse.json(
      { error: `Prompt too long (max ${MAX_PROMPT_LENGTH} characters)` },
      { status: 400 }
    );
  }

  const ip = getClientIp(request);
  const rate = checkRateLimit(ip);
  if (!rate.allowed) {
    const message =
      rate.reason === "daily_limit"
        ? "Book Scout has hit its daily recommendation limit — try again tomorrow."
        : "You've hit the hourly limit for recommendations — try again in a bit.";
    return NextResponse.json({ error: message }, { status: 429 });
  }

  let content;
  try {
    const result = await chatCompletion({ system: SYSTEM_PROMPT, user: prompt });
    content = result.content;
  } catch (err) {
    console.error("LLM call failed:", err?.message);
    return NextResponse.json(
      { error: "The recommendation engine is having trouble — try again shortly." },
      { status: 502 }
    );
  }

  const recs = extractJsonArray(content);

  if (!Array.isArray(recs) || recs.length === 0) {
    return NextResponse.json(
      { error: "Couldn't come up with recommendations for that — try rephrasing." },
      { status: 502 }
    );
  }

  const cleaned = recs
    .filter((r) => r && r.title)
    .map((r) => ({
      title: String(r.title),
      author: String(r.author || "Unknown"),
      year: r.year != null ? String(r.year) : "",
      oneLiner: String(r.oneLiner || ""),
    }));

  return NextResponse.json({ results: cleaned });
}
