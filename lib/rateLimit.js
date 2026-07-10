// In-memory rate limiting for /api/recommend. Resets on server restart —
// fine for a prototype, not durable across deploys/instances.

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const perIpHits = new Map(); // ip -> [timestamps]
let globalDay = { windowStart: Date.now(), count: 0 };

export function checkRateLimit(ip) {
  const now = Date.now();

  // Global daily counter
  if (now - globalDay.windowStart > DAY_MS) {
    globalDay = { windowStart: now, count: 0 };
  }
  if (globalDay.count >= 200) {
    return { allowed: false, reason: "daily_limit" };
  }

  // Per-IP hourly counter
  const hits = (perIpHits.get(ip) || []).filter((t) => now - t < HOUR_MS);
  if (hits.length >= 10) {
    perIpHits.set(ip, hits);
    return { allowed: false, reason: "ip_limit" };
  }

  hits.push(now);
  perIpHits.set(ip, hits);
  globalDay.count += 1;

  return { allowed: true };
}
