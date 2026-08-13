# Dewey — Maintainer Handoff

**Live:** https://deweybooks.vercel.app

**Repository:** https://github.com/WhatWouldDimaDo/book-scout

**Deployment:** pushes to `main` build in the linked Vercel project.

## Product

Dewey is a free library-planning web app. A visitor can paste a reading list, choose a supported BiblioCommons library and branch, and see live availability and call numbers. The app also offers book recommendations, generic starter lists, and a browser-local wishlist. It requires no account.

## Architecture

- `app/page.js` — client UI for list checks, recommendations, settings, and wishlist.
- `app/api/availability/route.js` — validates up to 25 books and checks branch availability.
- `app/api/recommend/route.js` — books-only recommendations with prompt and request limits.
- `lib/bibliocommons.js` — catalog search, match confidence, and availability adapter.
- `lib/llm.js` — server-only OpenRouter client.
- `lib/analytics.js` — explicit PostHog events and campaign attribution; no prompt or list text.
- `data/starterLists.json` — generic age-band and topic lists.

## Operational notes

- `OPENROUTER_API_KEY` is server-only and must remain in Vercel or an ignored local environment file.
- `NEXT_PUBLIC_POSTHOG_KEY` is an optional public client token; analytics is disabled when it is absent.
- The BiblioCommons JSON gateway is unofficial and may change.
- Rate limiting is in-memory and is not a dependable hard spending boundary across instances or deployments.
- Keep a provider-enforced budget on a dedicated Dewey OpenRouter key before broad promotion.
- Never add patron details, book-list text, recommendation prompts, or other personal content to analytics or fixtures.

## Verification

```bash
npm ci
npm run build
```

Then verify the list-check and recommendation flows, mobile layout, metadata, internal links, and explicit analytics events. See [README.md](README.md), [DEPLOY.md](DEPLOY.md), and [SECURITY.md](SECURITY.md) for public-facing guidance.
