/**
 * Phase A spike — 48-domain ground-truth set through the REAL waterfall.
 * Free rungs only (homepage + wikidata + direct LinkedIn verification from this box).
 * SERP excluded by the gate definition (">=55% HIGH without SERP").
 * Gate: >=55% high-confidence AND <=5% wrong-company on resolved rows.
 */
import { resolveDomain } from '../src/resolver.js';
import { createDomainCache } from '../src/cache.js';

const TRUTH = [
    ['stripe.com', 'Stripe'], ['vercel.com', 'Vercel'], ['gitlab.com', 'GitLab'],
    ['notion.so', 'Notion'], ['zapier.com', 'Zapier'], ['figma.com', 'Figma'],
    ['datadoghq.com', 'Datadog'], ['cloudflare.com', 'Cloudflare'], ['hubspot.com', 'HubSpot'],
    ['dropbox.com', 'Dropbox'], ['asana.com', 'Asana'], ['airtable.com', 'Airtable'],
    ['linear.app', 'Linear'], ['slack.com', 'Slack'], ['zoom.us', 'Zoom'],
    ['adobe.com', 'Adobe'], ['nvidia.com', 'NVIDIA'], ['spotify.com', 'Spotify'],
    ['pinterest.com', 'Pinterest'], ['discord.com', 'Discord'], ['atlassian.com', 'Atlassian'],
    ['canva.com', 'Canva'], ['mailchimp.com', 'Mailchimp'], ['intercom.com', 'Intercom'],
    ['loom.com', 'Loom'], ['calendly.com', 'Calendly'], ['doordash.com', 'DoorDash'],
    ['instacart.com', 'Instacart'], ['lyft.com', 'Lyft'], ['airbnb.com', 'Airbnb'],
    ['netflix.com', 'Netflix'], ['hulu.com', 'Hulu'], ['crunchbase.com', 'Crunchbase'],
    ['producthunt.com', 'Product Hunt'], ['substack.com', 'Substack'], ['ghost.org', 'Ghost'],
    ['webflow.com', 'Webflow'], ['wix.com', 'Wix'], ['squarespace.com', 'Squarespace'],
    ['godaddy.com', 'GoDaddy'], ['namecheap.com', 'Namecheap'], ['digitalocean.com', 'DigitalOcean'],
    ['vultr.com', 'Vultr'], ['twilio.com', 'Twilio'], ['sendgrid.com', 'SendGrid'],
    ['docsign.com', null], ['docusign.net', null], ['basecamp.com', 'Basecamp'],
].filter(([, t]) => t !== null);

const cache = createDomainCache({ kvStore: null, ttlDays: 30 });
const deps = {
    dnsPrecheck: async () => 'live',
    serpRung: async () => ({ slugs: [], blocked: false, requests: 0 }),
};

const results = [];
let cursor = 0;
async function lane() {
    while (cursor < TRUTH.length) {
        const [domain, expected] = TRUTH[cursor++];
        const t0 = Date.now();
        try {
            const row = await resolveDomain({
                domainRecord: { apex: domain, sld: domain.split('.')[0] },
                cache,
                proxyUrlFor: null,
                serpProxyUrlFor: null,
                useVpsRender: false,
                deps,
            });
            delete row._stats;
            const name = (row.companyName || '').toLowerCase();
            const ok = row.confidence !== 'low' && name.includes(expected.toLowerCase().split(' ')[0]);
            const wrong = row.confidence !== 'low' && !ok;
            results.push({ domain, expected, confidence: row.confidence, method: row.method, companyName: row.companyName, linkedinUrl: row.linkedinUrl, ok, wrong, ms: Date.now() - t0 });
        } catch (e) {
            results.push({ domain, expected, confidence: 'error', error: e.message, ms: Date.now() - t0 });
        }
        process.stdout.write(`\r${results.length}/${TRUTH.length} done`);
    }
}
await Promise.all(Array.from({ length: 4 }, () => lane()));

const total = results.length;
const high = results.filter(r => r.confidence === 'high').length;
const medium = results.filter(r => r.confidence === 'medium').length;
const low = results.filter(r => r.confidence === 'low' || r.confidence === 'error').length;
const wrong = results.filter(r => r.wrong).length;
const byMethod = {};
for (const r of results) byMethod[r.method] = (byMethod[r.method] || 0) + 1;

console.log('\n' + JSON.stringify({
    total, high, medium, low,
    highRate: +(high / total).toFixed(3),
    resolvedRate: +((high + medium) / total).toFixed(3),
    wrongCompany: wrong,
    wrongRateOnResolved: +((wrong / Math.max(high + medium, 1))).toFixed(3),
    byMethod,
}, null, 2));
for (const r of results) {
    console.log(`${r.ok === true ? 'OK ' : r.wrong ? 'BAD' : '.. '} ${r.domain.padEnd(18)} ${String(r.confidence).padEnd(7)} ${String(r.method || '').padEnd(16)} ${String(r.companyName || '-').padEnd(22)} ${r.linkedinUrl || ''}`);
}
