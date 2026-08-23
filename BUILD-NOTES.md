# BUILD NOTES — linkedin-company-by-domain v0.1 (2026-08-23)

Status: **code complete, 55/55 tests green, free rungs live-verified, keyword pass applied, GitHub repo live. NOT yet pushed to the Apify Store.**

- Repo: https://github.com/the-ai-entrepreneur-ai-hub/linkedin-company-by-domain (public, MIT, CI green)
- Keyword pass (rules from tracking/KEYWORD-REACH-AUDIT-2026-08-15.md): title contains exact buyer phrase "linkedin company by domain" (48/63); slug = head term; seoTitle carries Google-only variant "Domain to LinkedIn Company Finder - Verified API" (48/60); description 280/300; seoDescription 167/200; river heat ~320 u30 = inside the 300–5,000 band; README 1,084 words with quick-start code, cost math, MCP block, related actors. No claims of email/standby/dedicated-MCP (honesty rule #3).

## What was built
Five-rung resolution waterfall with verified-confidence billing, per the approved architecture:
`cache -> R1 homepage static -> R4 wikidata brand -> R2 slug probe (residential) -> R3 SERP (GOOGLE_SERP group) -> R5 VPS render`.
Only medium/high-confidence rows bill (`company-resolved` $0.0075). Cached rows are always free.
Monitor mode emits free diff summaries (headcount changes, renames, adds/removes) from a named KV snapshot.

## Live smoke (2026-08-23, $0 spent)
- stripe.com -> sameas:stripe, brand "Stripe" — HIGH path available
- vercel.com -> sameas:vercel, brand "Vercel Inc."
- gitlab.com -> sameas:gitlab-com (og:site_name junk "about.gitlab.com" is harmless: mutual-evidence check uses page HTML domain reference)
- Wikidata P856 returned [] for vercel.com — graceful; brand hints already present from homepage

## Files
- `.actor/actor.json` — PPE pricing filed at publish-time values ($0.002 start / $0.0075 resolved); env `@VPS_URL`/`@VPS_API_KEY` referenced so pushes re-link secrets (secret-envVar trap)
- `.actor/input_schema.json`, `.actor/output_schema.json` — output schema REQUIRED for publish (post-engagers trap)
- `src/resolver.js` — waterfall, dependency-injected for tests
- `src/guardrails.js` — dual-shape price reading + Boolean({}) regression + fail-closed gate (flagship incidents)
- `src/snapshot.js`, `src/cache.js`, `src/scorer.js`, `src/vps-client.js` (trimmed port), `src/rungs/*`
- `test/*.test.mjs` — 55 tests: normalize/homepage/scorer/guardrails/cache/snapshot/rungs/waterfall/billing-policy

## Before first push (checklist)
1. Phase A spike on platform or local: 50-domain ground-truth set. GATES: >=55% high-confidence without SERP AND blended COGS <=$0.002/row. Fail = do not publish.
2. `apify push` from this folder creates the actor PRIVATE first; run once with minimal input (`{"domains":["vercel.com"],"maxDomains":1}`), then set public via API PUT with categories (LEAD_GENERATION, AI).
3. Pricing in actor.json files at publish — no 14-day wait for initial pricing; do not change for ~30 days after (one-change-per-month lock).
4. VPS cache endpoint (`/cache/v1/get|set`) does not exist on the gateway yet — actor feature-detects and runs without it. Deploying it is optional follow-up (tiny FastAPI/sqlite on the gateway host).
5. Icon: generate via chatgpt-image-gen skill; Console JS file-injection upload (`PUT pictureUrl` external URLs rejected).

## Kill gates (from the flagship research verdict)
- Day 14 post-launch: <10 u7 -> archive
- Sep 30: <40 u30 -> archive
- Cap flagship-retention distraction at 3 days total
