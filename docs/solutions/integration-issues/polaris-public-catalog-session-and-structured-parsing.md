---
title: DeKalb Polaris requires a sessionful public-catalog adapter
date: 2026-08-13
category: integration-issues
module: Library catalog providers
problem_type: integration_issue
component: service_object
symptoms:
  - "Direct search-page parsing returned false not-found results for known books"
  - "Stateless availability calls returned POWERPAC-ERROR:TIMEOUT"
  - "Page-wide text matching produced wrong bib IDs, call numbers, and branch status"
root_cause: wrong_api
resolution_type: code_fix
severity: high
tags: [polaris, dekalb, catalog-adapter, anonymous-session, html-parsing, library-switching]
---

# DeKalb Polaris requires a sessionful public-catalog adapter

## Problem

The first DeKalb proof of concept treated Polaris like a stateless HTML endpoint. Known books were reported as missing, and the fallback availability parser could borrow status from the wrong branch.

## Symptoms

- The public `searchresults.aspx` response was only a shell; actual records lived in `ajaxResults.aspx?page=1`.
- A fresh `ajaxavailability.aspx` request timed out because it did not share the anonymous ASP.NET catalog session.
- Matching around every `bibid` scored unrelated surrounding text and sometimes selected media instead of a physical book.
- Crowded title searches could place an exact match on a later page, so a generic title such as “Curious George” appeared missing.
- When the chosen branch was absent, the parser fell back to every branch and could claim a book was on shelf locally.
- Individual item-status cells were not structurally reliable enough to determine shelf status; the branch header's `(N of M available)` count was authoritative.

## What Didn't Work

- Independent `fetch()` calls for search and availability did not preserve the catalog state.
- Parsing arbitrary text around `bibid` values did not maintain record boundaries.
- Counting checked-in item rows overcounted other branches.
- Adding the author to a title-only `TI` query caused legitimate title searches to miss.

## Solution

Use one isolated anonymous cookie jar per title and keep it through this read-only sequence:

1. Request `searchresults.aspx` with a title-only `TI` query and the physical-book filter.
2. Follow HTTP redirects and Polaris's HTTP-200 “Object moved” link.
3. Fetch `ajaxResults.aspx?page=1` in the same session. If the best relevance result is not an exact high-confidence match, repeat the search with title sorting via `ajaxResults.aspx?page=1&sort=TI`.
4. Parse each `search__position` result module into position, bib ID, displayed title, author, format, and cover.
5. Rank exact normalized title first, then author; reject nonphysical formats and low-confidence short-title matches. Use a keyword title-plus-author fallback only when title search is insufficient.
6. Treat every sort as a mutation of the anonymous search session. Use the result position and bib ID from the latest sorted result set, even when its match score ties an earlier candidate.
7. Fetch `ajaxavailability.aspx` with that current result position and bib ID in the same session.
8. Parse each `tr.location` plus its following `tr.piece` rows. Match the requested branch exactly after punctuation normalization, use the branch header's available count for status, use the `callnum` value, and count unique locations with available copies.
9. Rank available alternatives by unrounded geographic distance from the selected branch, return the nearest two, and round only their displayed distances.

Library-system switching must use the same registry on client and server. Clear old results, coerce unsupported formats, validate that a branch belongs to its system, disable searches while selection loads, and ignore responses from an older selection epoch.

## Why This Works

It follows the same anonymous protocol as the public Polaris UI and preserves the structural boundaries needed for deterministic matching. The provider returns the same normalized result shape as BiblioCommons without sharing session state globally or accessing patron data.

## Prevention

- Keep deterministic parser fixtures for exact titles, title-sort fallback positions, author disambiguation, media rejection, missing branches, header-derived status, call numbers, precise distance ranking, and expired sessions.
- Run `npm run test:polaris:live` before considering provider changes complete.
- Never classify provider/session failures as a genuine `not_found` result.
- Keep formats and bundled branches in `data/libraries.json` and validate them in the API.
- Add future catalog families through `lib/catalogProviders.js`, not library-slug conditionals spread through the UI.

## Related Issues

- `README.md` documents provider scope and the read-only live test.
- `HANDOFF.md` maps the registry and adapter files.
- `docs/screenshots/` contains the catalog and local-result evidence captured during verification.
