# Dewey

Dewey turns a reading list into a practical library trip. Paste up to 25 books—or ask for recommendations—choose a Fulton County Library branch, and see live shelf availability and call numbers.

[Try Dewey](https://deweybooks.vercel.app) · [Read the project story](https://dimadimadima.com/projects/dewey)

![Dewey showing three books on shelf at Ponce de Leon Branch with call numbers](public/social/dewey-facebook-result-state.jpg)

## What it does

- Checks a whole reading list against a selected library branch.
- Shows on-shelf, checked-out, and uncertain-match states with call numbers.
- Generates book recommendations and verifies them against the catalog.
- Saves a local wishlist without requiring an account.
- Includes generic age-band and topic starter lists.

The model recommends. The library catalog verifies. When the match is uncertain, Dewey says so instead of presenting a guess as fact.

## How it works

Dewey is a Next.js application. Server-side route handlers query the same BiblioCommons JSON gateway used by the public catalog, then apply title and author matching before returning availability to the browser. Recommendation requests use OpenRouter; the OpenRouter credential remains server-side.

The BiblioCommons gateway is undocumented and may change. Dewey is an independent community project and is not affiliated with or endorsed by Fulton County Library System or BiblioCommons.

## Local development

Requirements: Node.js 20 or newer and npm.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

Environment variables:

- `OPENROUTER_API_KEY` — server-only credential for recommendations. Availability checks work without it.
- `NEXT_PUBLIC_POSTHOG_KEY` — optional public PostHog project token for the intentionally instrumented funnel events.

Never prefix the OpenRouter key with `NEXT_PUBLIC_` or commit `.env.local`.

## Privacy and analytics

Dewey does not require an account. Wishlist data stays in the browser's local storage.

When PostHog is configured, Dewey records only explicit product events such as search started/completed, result count, selected branch, search mode, recommendation completion, and the project-story click. It does not send pasted book-list text or recommendation prompts to analytics. Recommendation prompts are sent to OpenRouter to generate the requested results, so users should not enter names or personal information.

## Cost and abuse controls

The prototype includes request limits, but its in-memory counters reset across deployments and server instances. Before broad promotion, use a Dewey-specific OpenRouter key with provider-enforced spend limits and replace or supplement the prototype limiter with durable abuse protection.

## Contributing and security

Bug reports and focused pull requests are welcome. Do not include patron information, API keys, personal reading data, or other private content in issues or test fixtures. Run `npm run lint` and `npm run build` before submitting a change.

Please report vulnerabilities privately as described in [SECURITY.md](SECURITY.md).

## Attribution and license

Built by [Dima Perkis](https://dimadimadima.com/projects/dewey).

The source is available under the MIT License. See [LICENSE](LICENSE).
