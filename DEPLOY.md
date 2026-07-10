# Book Scout — Deployment

## Deploy to Vercel (First Time)

```bash
cd /path/to/book-scout

# Link the project (creates new Vercel project)
vercel

# When prompted:
# - Project name: book-scout (or similar)
# - Framework: Next.js
# - Deploy to existing project: No (first time)

# Set environment variable for OpenRouter API key
vercel env add OPENROUTER_API_KEY production

# When prompted, paste your OpenRouter API key from https://openrouter.ai/keys

# Deploy to production
vercel --prod
```

Vercel will return a production URL. Share this URL with friends.

---

## Environment Variables

- **`OPENROUTER_API_KEY`** (production only) — Authenticate with OpenRouter for Claude Haiku recommendations. Get key from https://openrouter.ai/keys.

---

## Built-in Guardrails

### Rate Limiting (OpenRouter)
- **10 recs/hour per IP** — prevents abuse from single user spamming recommendations.
- **200 recs/day global** — hard cap across all users.

**Action:** If hitting limits, add exponential backoff client-side or cap UI recommendations to 3 per day per session.

### Book Availability Limits (BiblioCommons Gateway)
- **25 books max per request** — Fulton County Library API constraint. Paste-list feature splits large lists into chunks.

**Action:** Add warning if user pastes 26+ ISBNs. Auto-paginate or queue remaining requests.

### OpenRouter Spend Limits
Before sharing the live URL with friends, **set a hard cap on OpenRouter dashboard:**

1. Visit https://openrouter.ai/account/billing
2. Under "Spend Limits," set cap to **$5/month** (or lower if sensitive).
3. Set limit to **Limit per request** = $0.05 (kills runaway calls).

This prevents surprise bills if a friend loops the recommendation endpoint.

---

## Subsequent Deploys

```bash
cd /path/to/book-scout

# Deploy to production (env vars already set)
vercel --prod
```

---

## Debugging

- **OpenRouter errors:** Check API key in `vercel env ls` and compare to https://openrouter.ai/keys.
- **BiblioCommons 500s:** Gateway may be down. Check health via `curl -s https://gateway.bibliocommons.com/` (no auth needed).
- **Vercel logs:** `vercel logs --prod` streams production logs.

---

## Rollback

```bash
vercel rollback --prod
```

---

## Local Development

```bash
cd /path/to/book-scout

# For local testing of OpenRouter integration:
OPENROUTER_API_KEY=<your-key> npm run dev
```

Verify at `http://localhost:3000`.
