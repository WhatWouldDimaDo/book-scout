# Book Scout — PRD v1

**Owner:** Dima Perkis · **Status:** MVP shipped (July 2026) · **Live:** Vercel (git-linked to `WhatWouldDimaDo/book-scout`)

## One-liner
Paste a list of books — or describe what you're in the mood for — and see what's actually on the shelf at your Fulton County library branch. No login, no app, no friction.

## Why it wins (from competitive research, July 2026)
No existing tool combines all three: **batch list checking + branch-level physical shelf status + AI recs, zero login.** Library Extension is one-book-at-a-time; Libby checkers are ebook-only; BiblioCommons' own shelves need an account and manual entry. The moat is the combination, not any single piece. Risk: BiblioCommons is piloting AI discovery in-catalog — ship delight now, don't over-invest in defensibility.

## Audiences

| Persona | Who | Core job-to-be-done | Killer feature |
|---|---|---|---|
| **The Parent** | A parent or caregiver with kids 3–10 | "Get me 10 good picture books I can actually grab this Saturday" | Kids mode: age-appropriate recs + on-shelf filter |
| **The Book Lover** | Heavy readers with a 200-book want-to-read list | "Which of my Goodreads list is sitting on a shelf right now?" | CSV/list import + best-branch finder |
| **The Moody Reader** | Friends who don't know what's next | "I loved X, what now — and can I get it today?" | AI recs → one-tap availability |
| **The Thrifter** | Used-bookstore & library-sale regulars | "Is this $2 find worth it, or is it free at my branch?" | (Later) shelf-photo scan |
| **The Book Club** | Someone picking a title 8 people can all obtain | "Which candidate book has the most copies available?" | Copy counts across branches |

## Shipped (v1)
- 34-branch picker (persisted), default Ponce
- Paste-a-list availability (25/batch, precise `bl` catalog queries + fuzzy fallback, confidence badges)
- AI recs via OpenRouter Haiku (guardrailed: 10/hr/IP, 200/day, books-only prompt)
- Wishlist (localStorage), check-all, copy-as-text
- Light/dark, mobile-first, ATL-Radar-adjacent design system

## Roadmap — ranked by delight-per-complexity

### Now (v1.1 — each ≤ a day, no backend)
1. **Best Branch For My List** — the availability response already contains every branch's copies; add a "where should I go?" summary ranking branches by on-shelf count for the pasted list. *Zero new API calls — highest value-to-effort on the board.*
2. **Hold deep-links** — "Place hold" button straight to the fulcolibrary record page (link exists; make it a first-class CTA).
3. **Shareable wishlist** — encode list in URL params; friends open your link, see your list checked against *their* branch. Viral loop, no backend.
4. **Kids mode toggle** — audience switch that seasons the rec prompt (age bands: 3–5, 6–8, 9–12) and adds picture-book/easy-reader format codes to the catalog query.

### Next (v1.2 — still no accounts)
5. **Goodreads/StoryGraph import** — parse their CSV export in-browser, feed the checker in 25-book chunks with progress.
6. **Typo tolerance** — edit-distance match ("Atomik Habits" → *Atomic Habits*), known gap from testing.
7. **Copy counts on cards** — "3 on shelf here, 12 system-wide" for book-club decisions.
8. **PWA manifest** — add-to-home-screen so it feels like an app on friends' phones.

### Later (only if friends actually ask)
9. Shelf-photo mode — snap a used-bookstore shelf → OCR titles → batch check (needs vision model call)
10. Any-BiblioCommons-library picker (same gateway serves hundreds of US systems)
11. "Notify me when it's back" (needs backend + email — first feature that breaks the no-infrastructure rule; resist)

## Non-goals (guardrails against complexity creep)
- **No accounts, ever, in prototype phase** — localStorage + share-links cover it
- No hold placement inside the app (auth against patron accounts = liability + fragility)
- No database until a feature is impossible without one
- No scraping of licensed library databases (Data Axle, ProQuest, etc.)
- Not a Goodreads replacement — no reviews, ratings, or social graph

## Success criteria (prototype phase)
- 5+ friends use it twice without being reminded
- One unsolicited "can it do X" request per week (signal for Next-tier picks)
- A librarian reacts with curiosity, not a cease-and-desist

## Known risks
- **Unofficial API** — gateway could change/block; keep the matcher isolated in `lib/bibliocommons.js` for a quick adapter swap
- **OpenRouter spend** — capped by rate limits + $5 dashboard limit
- **BiblioCommons ships native AI discovery** — accept; this is a prototype, not a startup (unless friends' usage says otherwise)
