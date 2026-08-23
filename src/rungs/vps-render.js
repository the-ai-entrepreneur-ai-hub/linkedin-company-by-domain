/**
 * R5 — VPS render lane. The gateway's /crawl endpoint renders JavaScript, so SPA homepages
 * that returned empty/static shells in R1 get a second pass through the idle VPS
 * (sunk cost, $0 marginal). Also used for LinkedIn page reads when the TLS lane is challenged.
 */

import { crawlPage } from '../vps-client.js';
import { extractJsonLdEvidence, extractLinkedinHrefs, extractOgSiteName } from './homepage.js';

/**
 * @returns {Promise<{ok: boolean, html: string, brandHints: string[], candidates: Array}>}
 */
export async function vpsRenderHomepageRung({ apex, proxyUrl }) {
    try {
        const rendered = await crawlPage({
            url: `https://${apex}/`,
            proxy: proxyUrl,
            timeout: 40,
        });
        const html = rendered?.html || rendered?.body || '';
        if (!html) return { ok: false, html: '', brandHints: [], candidates: [] };

        const ld = extractJsonLdEvidence(html);
        const hrefs = extractLinkedinHrefs(html);
        const seen = new Set(ld.sameAs.map((c) => c.slug));
        const candidates = [
            ...ld.sameAs.map((c) => ({ ...c, evidence: 'homepage-sameas' })),
            ...hrefs.filter((c) => !seen.has(c.slug)).map((c) => ({ ...c, evidence: 'homepage-link' })),
        ];
        return {
            ok: true,
            html,
            brandHints: [...new Set([...ld.names, extractOgSiteName(html)])].filter(Boolean),
            candidates,
        };
    } catch {
        return { ok: false, html: '', brandHints: [], candidates: [] };
    }
}
