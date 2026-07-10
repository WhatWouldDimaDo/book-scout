---
module: deployment
date: "2026-07-10"
problem_type: build_error
component: tooling
severity: medium
category: build-errors
symptoms:
  - "Vercel git deployment state ERROR within seconds of push"
  - "Build log ends after 'Cloning completed' — no install, no build output, no error events"
  - "Same commit builds clean locally with `npm run build`"
root_cause: config_error
resolution_type: workflow_improvement
tags: ["vercel", "ci", "flaky-infra", "deployment"]
---

# Vercel build dies instantly post-clone with empty logs → retry before debugging

## Problem
Three consecutive Vercel production builds (git-linked project) failed with state ERROR. Logs stopped at `Cloning completed: <ms>` — zero build/install/error lines. Local `npm run build` passed on the identical commit.

## Symptoms
See frontmatter. Key signature: failure occurs *before* any framework detection or `npm install` output — too early to be application code.

## What Didn't Work
- Reading build logs with `errorsOnly` (no error events exist)
- Inspecting project settings via API (nodeVersion, framework — all normal)
- Hypothesizing about commit content (fonts, config) — the failing commit was 5 clean source files

## Solution
`git commit --allow-empty -m "Redeploy" && git push`. The third retry built in 15s with zero code changes, confirming platform flakiness. Verified by polling the production alias for the new page title.

## Why This Works
A build that dies between clone and dependency install never executed project code — the container itself failed. Vercel occasionally has short-lived build-infra incidents; consecutive failures within minutes of each other share the same bad infra window.

## Prevention
Decision rule: if the Vercel build log contains **no lines after cloning**, retry (empty commit or dashboard Redeploy) before debugging code. Only investigate the commit when the log shows the build actually starting (install/compile output). Budget: 2-3 retries spaced a few minutes apart, then check vercel-status.com.
