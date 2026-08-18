# Dewey — Maintainer Handoff

**Live:** https://deweybooks.vercel.app

**Repository:** https://github.com/WhatWouldDimaDo/book-scout

**Deployment:** pushes to `main` build in the linked Vercel project.

**Latest verified release:** 2026-08-18 feature commit `156fd5d`, Vercel deployment
`dpl_EY8uWxPAScS4BRLWsDCjWY1PEg2r`. The direct app and the portfolio proxy are
live at https://deweybooks.vercel.app and https://dimadimadima.com/dewey.

## Product

Dewey is a free library-planning web app. A visitor can paste a reading list, choose a supported library system and branch, and see live availability and call numbers. The app also offers book recommendations, generic starter lists, and a browser-local wishlist. It requires no account.

## Architecture

- `app/page.js` — client UI for list checks, recommendations, settings, and wishlist.
- `app/api/availability/route.js` — validates up to 25 books and checks branch availability.
- `lib/librarySystems.js` — system registry, capabilities, bundled branches, and server-side validation.
- `lib/catalogProviders.js` — common provider dispatch contract.
- `app/api/recommend/route.js` — books-only recommendations with prompt and request limits.
- `lib/bibliocommons.js` — catalog search, match confidence, and availability adapter.
- `lib/polaris.js` — configurable print-book adapter using an isolated logged-out Polaris session per title.
- `lib/polaris-parser.mjs` — structured Polaris result and branch-holdings parser.
- `components/BranchPicker.js` — unified ZIP/city/address/name search, explicit nearby-location action, and mobile branch sheet.
- `lib/branchLocator.mjs` + `data/branchLocations.json` — client-side search/distance logic and official branch coordinates.
- `data/polarisBranches.json` — bundled branch choices for verified Polaris systems.
- `data/additionalBranchLocations.json` — reviewed official Fairfax coordinates appended during refresh.
- `scripts/refresh-branch-locations.mjs` — rebuilds the location bundle from official Fulton and DeKalb pages plus reviewed additional locations.
- `lib/llm.js` — server-only OpenRouter client.
- `lib/analytics.js` — explicit PostHog events and campaign attribution; no prompt or list text.
- `data/starterLists.json` — generic age-band and topic lists.
- `docs/research/catalog-coverage-estimate-2026-08-18.md` — sourced, caveated network/outlet/service-population coverage estimate.

## Operational notes

- `OPENROUTER_API_KEY` is server-only and must remain in Vercel or an ignored local environment file.
- `NEXT_PUBLIC_POSTHOG_KEY` is an optional public client token; analytics is disabled when it is absent.
- The BiblioCommons JSON gateway is unofficial and may change.
- The Polaris previews are unofficial, print-only, and depend on public HTML. Each system supplies an HTTPS catalog base and numeric context in `data/libraries.json`; every lookup must preserve one anonymous session across search, AJAX results, and holdings.
- A system is enabled only after a real anonymous title search and holdings check passes against its current public catalog. The current verified Polaris cohort is DeKalb, Fairfax, Irving, Ames, Opelika, Urbandale, Santa Cruz County, and San Diego. San Diego moved from BiblioCommons to Polaris in August 2026; keep vendor configuration current rather than leaving a dead catalog selector.
- Library formats and branches are validated from the shared registry before a provider is called. New catalog families should be added as provider adapters rather than UI/API special cases.
- Rate limiting is in-memory and is not a dependable hard spending boundary across instances or deployments.
- Keep a provider-enforced budget on a dedicated Dewey OpenRouter key before broad promotion.
- Never add patron details, book-list text, recommendation prompts, or other personal content to analytics or fixtures.

## Verification

```bash
npm ci
npm run test:polaris
npm test
npm run test:polaris:live
npm run build
```

Then verify the list-check and recommendation flows, mobile layout, metadata, internal links, and explicit analytics events. See [README.md](README.md), [DEPLOY.md](DEPLOY.md), and [SECURITY.md](SECURITY.md) for public-facing guidance.

The 2026-08-18 release passed 18 unit/integration tests, a clean production
build, live positive-control searches against all eight configured Polaris
catalogs, and production branch discovery against all 32 configured
BiblioCommons catalogs. A 390px browser check found no horizontal overflow;
Fairfax/Chantilly returned an on-shelf *Curious George* record with a call
number through both the direct app API and the `/dewey` reverse proxy. Vercel
and browser error scans were clean.
