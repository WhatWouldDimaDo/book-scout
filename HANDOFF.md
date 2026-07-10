# HANDOFF — Dewey (Book Scout) · cold-start

**Live:** https://deweybooks.vercel.app · **Repo:** github.com/WhatWouldDimaDo/book-scout · **Deploy:** reviewed changes to main deploy through Vercel.

## What this is
Public web app for readers: paste a book list (or tap a kids starter list, or get AI recs), pick a Fulton County branch (default PONCE), see what's physically on the shelf. No login; wishlist in localStorage. Named **Dewey**, Library Nostalgia theme (see BRANDING.md decision).

## Architecture (all in this dir)
- `app/page.js` — single-page client UI: 3 tabs (Check a List / Get Recs / Wishlist), branch picker, starter-list chips (lucide icons via `LIST_ICONS` map), theme toggle (light default)
- `app/api/availability/route.js` — POST {books[≤25], branch} → per-book status via `lib/bibliocommons.js` (concurrency 4)
- `app/api/recommend/route.js` — POST {prompt} → OpenRouter `anthropic/claude-haiku-4.5`, 8 recs JSON; guardrails: 10/hr/IP + 200/day global (`lib/rateLimit.js`, in-memory), 500-char prompt cap, 503 if no key
- `lib/bibliocommons.js` — THE core. `searchType=bl` field-scoped query (`title:(...) author:(...) formatcode:(BK OR PAPERBACK OR LPRINT)`) → smart-search fallback → Jaccard≥0.5 + author-last-name gate → availability fetch. Returns status/callNumber/dueDate/otherBranchCount/recordUrl/coverUrl (Syndetics jacket, hotlinkable)
- `data/branches.json` — 34 Fulton branch codes · `data/starterLists.json` — 11 kids lists, 163 verified books
- `app/globals.css` — token-driven theme: aged paper light (#f4eede/#b5382e stamp red) default, reading-room dark; stamp-style pills, index-card red top rules

## API knowledge (verified live 2026-07-10)
Gateway: `gateway.bibliocommons.com/v2/libraries/fulcolibrary/` — no auth, server-side only (CSP blocks browser). Gotchas in `docs/solutions/integration-issues/`. Same gateway serves hundreds of US libraries (slug swap) — multi-library is a Later roadmap item.

## Known issues / decisions
- Typo tolerance missing ("Atomik Habits" → not found); needs edit-distance
- Vercel builds sometimes die post-clone with EMPTY logs = platform flake → empty-commit retry (playbook: `docs/solutions/build-errors/`)
- Rate limits reset on redeploy (in-memory) — accepted for prototype
- Non-goals are contractual: no accounts, no DB, no patron-auth holds (PRD.md)

## Next up (PRD.md v1.1, ranked)
1. **Best Branch For My List** — availability response already holds all branches' copies; rank branches by on-shelf count for the checked list. Zero new API calls.
2. Shareable wishlist via URL params
3. Kids-mode rec toggle (age bands season the prompt + format codes)
4. "Place hold" CTA (recordUrl already returned)

## Key docs here
PRD.md (personas/roadmap/non-goals) · BRANDING.md (18 names, logo prompts, theme DECISION) · PITCH.md (friend pitches + GPT infographic prompt) · DEPLOY.md · ROADMAP.md (phase 2/3) · docs/solutions/ (compound learnings)

