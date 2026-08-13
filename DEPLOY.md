# Dewey Deployment Guide

Dewey deploys from the canonical GitHub repository to the existing Vercel project named `bookscout`.

## Link a local checkout

From the repository root:

```bash
vercel link --project bookscout
```

Linking creates a local ignored `.vercel/` directory. Confirm the selected project before continuing.

## Environment variables

Configure these in Vercel rather than committing values:

- `OPENROUTER_API_KEY` — server-only credential for recommendation and normalization requests.
- `NEXT_PUBLIC_POSTHOG_KEY` — optional public PostHog project token for explicit funnel events.

For local development, copy `.env.example` to the ignored `.env.local` file and add only the values needed for the test. Never print, screenshot, or commit environment values.

## Cost and abuse controls

Use a dedicated Dewey OpenRouter key and set the strongest available provider-side monthly budget, per-request limit, and alerts. The current in-memory limiter is prototype friction; it resets across deployments and instances and is not a durable spending boundary.

Before a broad public launch, add durable abuse protection or confirm that the provider-enforced hard cap is sufficient for the intended traffic.

## Build and preview

```bash
npm ci
npm run build
vercel
```

Review the preview URL, exact Git diff, mobile flow, metadata, and analytics before production deployment.

## Production

Production deploys normally follow a reviewed merge to `main`. Do not use an ad hoc production deploy to bypass repository review.

## Operational checks

- Recommendation failures: confirm the environment-variable name and inspect redacted Vercel logs.
- Availability failures: verify the BiblioCommons gateway and the isolated adapter in `lib/bibliocommons.js`.
- Analytics failures: confirm `NEXT_PUBLIC_POSTHOG_KEY` is present and verify only the documented event names and non-sensitive properties.
- Rollback: use the Vercel dashboard or `vercel rollback` after identifying the intended deployment.
