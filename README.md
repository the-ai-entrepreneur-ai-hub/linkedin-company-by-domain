# LinkedIn Company by Domain - Verified Finder API

[LinkedIn Company by Domain](https://apify.com/george.the.developer/linkedin-company-by-domain?fpr=bbquoh) is an Apify Actor that resolves any website domain to its official LinkedIn company page and returns the match with a verified confidence score, employee count and follower count, without logins, cookies or manual URL guessing.

> Every billed row carries mutual evidence. The domain's own website points at the LinkedIn page AND the page agrees back. Rows that cannot prove it are free.

Batch up to 50,000 domains. Verified confidence scoring. Free 30 day resolution cache. Free monitoring diffs on scheduled runs. MCP ready for AI agents.

## Pricing (Pay Per Event)

| Event | Price |
|---|---|
| Actor start | $0.002 per run |
| Verified company resolved | $0.0075 per row ($7.50 per 1,000) |

You pay $7.50 per 1,000 resolved domains and $0 for anything unresolved, cached within 30 days, or low confidence. A 1,000 domain run that resolves 850 costs $6.38, not $7.50.

### Cost math vs doing it manually

Manual lookup takes about a minute per domain at $30 per hour, which is $0.50 per domain or $5,000 of labor for 10,000 domains. This actor resolves the same 10,000 domains for $75 in minutes. That is a 98.5 percent cost reduction on the same work.

## Quick start

curl

```bash
curl -X POST "https://api.apify.com/v2/acts/george.the.developer~linkedin-company-by-domain/run-sync-get-dataset-items?token=$APIFY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"domains": ["stripe.com", "vercel.com", "gitlab.com"]}'
```

Node.js (npm install apify-client)

```js
import { ApifyClient } from 'apify-client';

const client = new ApifyClient({ token: process.env.APIFY_TOKEN });
const { items } = await client.actor('george.the.developer/linkedin-company-by-domain')
    .call({ domains: ['stripe.com', 'vercel.com'] });
console.log(items);
```

Python (pip install apify-client)

```python
from apify_client import ApifyClient

client = ApifyClient("MY_APIFY_TOKEN")
run = client.actor("george.the.developer/linkedin-company-by-domain").call(
    run_input={"domains": ["stripe.com", "vercel.com"]}
)
for item in client.dataset(run["defaultDatasetId"]).iterate_items():
    print(item)
```

Runnable copies live in [examples/](examples/).

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

Honest limits, stated up front.

- No email addresses. Email finding was measured against live B2B infrastructure and does not produce verifiable results at acceptable cost, so we do not sell unverifiable rows.
- No individual employee profiles. This actor resolves companies. Use [our employees scraper](https://apify.com/george.the.developer/linkedin-company-employees-scraper?fpr=bbquoh) downstream on the linkedinUrl field.
- No social media URLs other than LinkedIn.
- Low confidence guesses are labeled confidence low and charged $0. They are never silently mixed into billed rows.

## How verification works (why wrong company rows do not happen)

Most domains are resolved in this order, stopping as soon as proof is sufficient.

1. The company's own website declares its LinkedIn page in JSON-LD sameAs data or footer links. Free.
2. Slug probe checks linkedin.com/company/{your-domain-name} directly through a residential session.
3. Wikidata gives an authoritative brand name lookup by official website. Free.
4. Google search restricted to linkedin.com/company, used only when cheaper rungs are inconclusive.
5. A rendered page pass for JavaScript only websites.

A candidate page then has to agree with the site that nominated it (name match or a reference to your domain) before it bills at high or medium confidence. Disagreement means a free low confidence row.

## Use cases

1. CRM enrichment. Turn the website column of your lead list into clean LinkedIn company URLs for Clay, HubSpot or Pipedrive.
2. Investment and sales research batches. Resolve 10,000 portfolio or prospect domains in one scheduled run. Only new or stale entries ever cost money thanks to the cache.
3. Company change monitoring. Schedule weekly runs in monitor mode and receive free diffs covering headcount changes, renames, new and removed companies.

## How to use

1. Paste domains (anything from stripe.com to full URLs) into Website Domains.
2. Choose resolve for a one shot run or monitor for diffs against your previous run.
3. Run. Read rows from the dataset or plug the dataset URL straight into n8n, Clay or Make.

### Input parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| domains | array | required | Websites to resolve; duplicates collapsed automatically |
| mode | select | resolve | resolve or monitor |
| monitorBatchId | string | default | Named batch for monitor diffs |
| forceRefresh | boolean | false | Ignore cache and re-resolve everything |
| cacheTtlDays | integer | 30 | How long resolutions stay cached |
| includeUnresolved | boolean | true | Emit free rows for unresolved domains |
| maxDomains | integer | 1000 | Hard cap per run (max 50,000) |
| concurrency | integer | 10 | Parallel domains |

## Call it from the Apify MCP server

AI agents can reach this actor through the Apify MCP server.

```
https://mcp.apify.com/?tools=george.the.developer/linkedin-company-by-domain
```

## Integration snippets

Clay, as an HTTP API enrichment column

```
POST https://api.apify.com/v2/acts/george.the.developer~linkedin-company-by-domain/run-sync-get-dataset-items?token=YOUR_TOKEN
{ "domains": ["{{website}}"] }
```

n8n and Make use the Apify node. Set the actor to linkedin-company-by-domain, pass domains from your sheet and iterate dataset items.

## FAQ

### How is this different from other domain to LinkedIn actors?

They bill every attempt from a single discovery source. This one requires two independent sources to agree before billing, caches results for 30 days free of charge and never charges an unresolved domain.

### What happens when a domain cannot be matched?

You get one row explaining why in the qualityState field, charged $0. Turn includeUnresolved off if you want billed rows only.

### Does this need my LinkedIn account or cookies?

No. The actor reads public pages and never logs in.

### Can I monitor headcount changes over time?

Yes. Set mode to monitor and schedule weekly runs. Each run emits one free diff summary covering new companies, headcount changes and renames. Snapshots live in your own account.

### What does cached mean on a row?

The same domain resolved within the TTL window. Cached rows return instantly and are always free. Repeat runs only pay for genuinely new work.

## Changelog

0.1 (2026-08-23). Initial release. Five source resolution waterfall, verified confidence scoring, free monitoring diffs, 30 day resolution cache, batch up to 50k domains.

## Related actors

- [LinkedIn Company Employees Scraper](https://apify.com/george.the.developer/linkedin-company-employees-scraper?fpr=bbquoh) feeds resolved linkedinUrls in and gets verified employee profiles out.
- [LinkedIn Post Engagers Scraper](https://apify.com/george.the.developer/linkedin-post-engagers-scraper?fpr=bbquoh) turns post reactions and comments into ICP matched leads.

## License

MIT, see [LICENSE](LICENSE). The hosted actor on the [Apify Store](https://apify.com/george.the.developer/linkedin-company-by-domain?fpr=bbquoh) is the supported, managed way to run this.

## Support

Found a bug or need a feature? Open an issue on [GitHub](https://github.com/the-ai-entrepreneur-ai-hub/linkedin-company-by-domain/issues) or message george.the.developer on Apify.
