# LinkedIn Company by Domain — Verified Finder API

[LinkedIn Company by Domain](https://apify.com/george.the.developer/linkedin-company-by-domain) is an Apify Actor that resolves any website domain to its official LinkedIn company page and returns the match with a verified confidence score, employee count, and follower count — without logins, cookies, or manual URL guessing.

> **Every billed row carries mutual evidence: your domain's own website points at the LinkedIn page AND the page agrees back. Rows that can't prove it are free.**

✅ Batch up to 50,000 domains · ✅ Verified confidence scoring · ✅ Free 30-day resolution cache · ✅ Free monitoring diffs on scheduled runs · ✅ MCP ready for AI agents

## Quick start

**curl:**
```bash
curl -X POST "https://api.apify.com/v2/acts/george.the.developer~linkedin-company-by-domain/run-sync-get-dataset-items?token=$APIFY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"domains": ["stripe.com", "vercel.com", "gitlab.com"]}'
```

**Node.js** (`npm install apify-client`):
```js
import { ApifyClient } from 'apify-client';

const client = new ApifyClient({ token: process.env.APIFY_TOKEN });
const { items } = await client.actor('george.the.developer/linkedin-company-by-domain')
    .call({ domains: ['stripe.com', 'vercel.com'] });
console.log(items);
```

**Python** (`pip install apify-client`):
```python
from apify_client import ApifyClient

client = ApifyClient("MY_APIFY_TOKEN")
run = client.actor("george.the.developer/linkedin-company-by-domain").call(
    run_input={"domains": ["stripe.com", "vercel.com"]}
)
for item in client.dataset(run["defaultDatasetId"]).iterate_items():
    print(item)
```

Runnable copies live in [`examples/`](examples/).

## Pricing (Pay Per Event)

| Event | Price |
|---|---|
| Actor start | **$0.002** per run |
| Verified company resolved | **$0.0075** per row (**$7.50 per 1,000**) |

**You pay $7.50 per 1,000 resolved domains — and $0 for anything unresolved, cached (within 30 days), or low-confidence.** A 1,000-domain run that resolves 850 costs $6.38, not $7.50.

### Cost math vs doing it manually

- Manual lookup: ~1 min/domain at $30/h = **$0.50/domain** → 10,000 domains = **$5,000 of labor**
- This actor: **$0.0075/domain** → 10,000 domains = **$75**, resolved in minutes
- That is a 98.5% cost reduction on the same work.

## What data you get per domain

```json
{
  "domain": "deathwishcoffee.com",
  "linkedinUrl": "https://www.linkedin.com/company/death-wish-coffee/",
  "companyName": "Death Wish Coffee",
  "confidence": "high",
  "method": "homepage-sameas",
  "employeeCount": 213,
  "followers": 45600,
  "websiteStatus": "live",
  "cached": false,
  "charged": true
}
```

## What is NOT returned

Honest limits, stated up front:

- **No email addresses.** Email finding was measured against live B2B infrastructure and does not produce verifiable results at acceptable cost — we do not sell unverifiable rows.
- **No individual employee profiles.** This actor resolves companies; use [our employees scraper](https://apify.com/george.the.developer/linkedin-company-employees-scraper) downstream on `linkedinUrl`.
- **No social media URLs other than LinkedIn.**
- **Low-confidence guesses are labeled `confidence: "low"` and charged $0**, never silently mixed into billed rows.

## How verification works (why wrong-company rows don't happen)

Most domains are resolved in this order, stopping as soon as proof is sufficient:

1. **The company's own website** declares its LinkedIn page (JSON-LD `sameAs`, footer links) — free.
2. **Slug probe**: checks `linkedin.com/company/{your-domain-name}` directly through a residential session.
3. **Wikidata**: authoritative brand name lookup by official website — free.
4. **Google search** restricted to `linkedin.com/company` — used only when cheaper rungs are inconclusive.
5. **Rendered page pass** for JavaScript-only websites.

A candidate page then has to agree with the site that nominated it (name match or a reference to your domain) before it bills at `high`/`medium`. Disagreement = free low-confidence row.

## Use cases

1. **CRM enrichment** — turn the `website` column of your lead list into clean LinkedIn company URLs for Clay, HubSpot, or Pipedrive.
2. **Investment / sales research batches** — resolve 10,000 portfolio or prospect domains in one scheduled run; only new or stale entries ever cost money thanks to the cache.
3. **Company change monitoring** — schedule weekly runs in `monitor` mode and receive free diffs: headcount changes, renames, new and removed companies.

## How to use

1. Paste domains (anything from `stripe.com` to full URLs) into **Website Domains**.
2. Choose **resolve** (one-shot) or **monitor** (diffs against your previous run).
3. Run. Read rows from the dataset, or plug the dataset URL straight into n8n/Clay/Make.

### Input parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `domains` | array | required | Websites to resolve; duplicates collapsed automatically |
| `mode` | select | `resolve` | `resolve` or `monitor` |
| `monitorBatchId` | string | `"default"` | Named batch for monitor diffs |
| `forceRefresh` | boolean | `false` | Ignore cache and re-resolve everything |
| `cacheTtlDays` | integer | `30` | How long resolutions stay cached |
| `includeUnresolved` | boolean | `true` | Emit free rows for unresolved domains |
| `maxDomains` | integer | `1000` | Hard cap per run (max 50,000) |
| `concurrency` | integer | `10` | Parallel domains |

## Call it from the Apify MCP server

AI agents: this actor is available via the Apify MCP server.

```
https://mcp.apify.com/?tools=george.the.developer/linkedin-company-by-domain
```

## Integration snippets

**Clay** — HTTP API enrichment column:
```
POST https://api.apify.com/v2/acts/george.the.developer~linkedin-company-by-domain/run-sync-get-dataset-items?token=YOUR_TOKEN
{ "domains": ["{{website}}"] }
```

**n8n / Make** — Apify node → set Actor to `linkedin-company-by-domain`, pass `domains` from your sheet, iterate dataset items.

**curl:**
```bash
curl -X POST "https://api.apify.com/v2/acts/george.the.developer~linkedin-company-by-domain/run-sync-get-dataset-items?token=$TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"domains": ["stripe.com", "vercel.com", "gitlab.com"], "maxItems": 3}'
```
## FAQ

### How is this different from other domain-to-LinkedIn actors?
They bill every attempt from a single discovery source. This one requires two independent sources to agree before billing, caches results for 30 days free of charge, and never charges an unresolved domain.

### What happens when a domain cannot be matched?
You get one row explaining why (`qualityState`), charged $0. Turn `includeUnresolved` off if you want billed rows only.

### Does this need my LinkedIn account or cookies?
No. The actor reads public pages and never logs in.

### Can I monitor headcount changes over time?
Yes — set `mode: "monitor"` and schedule weekly runs. Each run emits one free diff summary (new companies, headcount changes, renames). Snapshots live in your own account.

### What does "cached" mean on a row?
The same domain resolved within the TTL window. Cached rows return instantly and are always free — repeat runs only pay for genuinely new work.

## Changelog

**0.1 (2026-08-23):** Initial release. Five-source resolution waterfall, verified confidence scoring, free monitoring diffs, 30-day resolution cache, batch up to 50k domains.

## Related actors

- [LinkedIn Company Employees Scraper](https://apify.com/george.the.developer/linkedin-company-employees-scraper) — feed resolved `linkedinUrl`s in, get verified employee profiles out.
- [LinkedIn Post Engagers Scraper](https://apify.com/george.the.developer/linkedin-post-engagers-scraper) — turn post reactions and comments into ICP-matched leads.

## License

MIT — see [LICENSE](LICENSE). The hosted actor on the [Apify Store](https://apify.com/george.the.developer/linkedin-company-by-domain) is the supported, managed way to run this.

## Support

Found a bug or need a feature? Open an issue on [GitHub](https://github.com/the-ai-entrepreneur-ai-hub/linkedin-company-by-domain/issues) or message `george.the.developer` on Apify.
