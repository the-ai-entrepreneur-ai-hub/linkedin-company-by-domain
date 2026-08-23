# BUILD NOTES — linkedin-company-by-domain v0.1 (2026-08-23)

Status: **🚀 LAUNCHED & PUBLIC** — https://apify.com/george.the.developer/linkedin-company-by-domain
Actor ID: `0reNPvdycTAAOpOYQ` · build 0.1.10 = latest · PPE live · repo: https://github.com/the-ai-entrepreneur-ai-hub/linkedin-company-by-domain

## Launch record (2026-08-23)

| Step | Result |
|---|---|
| Local strict spike (46 domains, single IP, no SERP) | 50–52% high / ~84% resolved / 2.6% wrong |
| Platform Phase A run `TdvHyIoWW3uv05Mdo` | **56.5% high / 91.3% resolved / 2.4% wrong / 0 SERP requests — GATES MET** |
| Billing sanity | log: `Pricing read: PPE=true`, `charged=42 ($0.3150)` exact |
| Compute | 0.196 CU @1024MB → defaultRunOptions.memoryMbytes now 512 (memMax measured 109MB) |
| Publish | isPublic=true, LEAD_GENERATION+AI, initial PPE filed pre-publish (no 14-day wait) |

The 4 platform rejections were CORRECT rejections (LINEAR GmbH≠Linear, Ghost Films≠Ghost, junk-name Namecheap, ambiguous Basecamp) — competitor products bill these rows.

## Traps hit & fixed today (all documented patterns confirmed again)
1. `typeof null === 'object'` on injected-transport guard → null-proxy crash
2. Partial `deps` override replaced defaults instead of merging → waterfall threw
3. Missing `vpsReady` import after lane refactor
4. CLI did NOT apply `pricingPerEvent` from actor.json → filed via REST while private (immediate)
5. `valueHash not allowed` version PUT trap → strip placeholder @VPS_* secret envVars entirely
6. `memoryMbytes` belongs on ACTOR `defaultRunOptions`, NOT the version object (`not allowed by schema`)
7. Publish requires `"output": "./output_schema.json"` key in actor.json AND the `actorOutputSchemaVersion:1` format (dataset-views format fails `schemas-required`)
8. `X-API-Token` header is not Apify auth — use `?token=` query everywhere
9. AUTO proxy group = datacenter exits = LinkedIn 999s → default RESIDENTIAL group

## Economics note (honest)
Phase A cold run cost ≈ compute $0.29@1024MB + ~27MB residential ≈ $0.51 vs $0.317 gross billed.
Thin negative on SMALL forceRefresh batches. Improves with: memory now halved (512MB), 30-day cache
(repeat runs ≈ free COGS), larger batches amortizing start overhead, SERP rarely firing (free rungs dominate).
WATCH from first real customers; if blended margin stays negative after cache effects, move
company-resolved $0.0075→$0.01 at next month's pricing window (one-change rule).

## Kill gates (from flagship research verdict)
- Day 14 post-launch (~Sep 6): <10 u7 → archive
- Sep 30: <40 u30 → archive
- Flagship-retention distraction cap: 3 days (consumed ~1 today)

## Next actions
1. Daily landing watch Sep 6: u7, charged rows, failure rate, new reviews
2. n8n template #2 (domain list → resolved companies → Sheets) — EXP-2
3. Glama listing + affiliate tag off-platform links — EXP-3 (after joining affiliate.apify.com)
4. Icon upload via Console JS injection (external pictureUrl rejected)
5. Store-search indexing check ~Aug 25 (river_scan q: 'linkedin company by domain')
