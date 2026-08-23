/**
 * Quick start: resolve a few domains through the hosted Apify Actor.
 * Requires APIFY_TOKEN in the environment. `npm install apify-client`
 */
import { ApifyClient } from 'apify-client';

const client = new ApifyClient({ token: process.env.APIFY_TOKEN });

const run = await client
    .actor('george.the.developer/linkedin-company-by-domain')
    .call({
        domains: ['stripe.com', 'vercel.com', 'gitlab.com'],
        includeUnresolved: true,
    });

const { items } = await client.dataset(run.defaultDatasetId).listItems();
for (const item of items) {
    console.log(
        `${item.domain.padEnd(20)} ${String(item.companyName || '-').padEnd(24)} `
        + `${item.confidence.padEnd(7)} $${item.charged ? '0.0075' : '0.0000'}`,
    );
}
