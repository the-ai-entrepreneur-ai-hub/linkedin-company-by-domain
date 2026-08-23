/**
 * R3 — Google SERP discovery through Apify's GOOGLE_SERP proxy group
 * (~$0.003/request — the same lane and cost model as the flagship's Phase A).
 *
 * Only reached when the free rungs (homepage, slug, wikidata) could not produce a
 * HIGH-confidence verdict. Query is exact: `site:linkedin.com/company "{apex}"`.
 */

export function buildSerpQueries({ apex = '', brandHints = [] }) {
    const queries = [`site:linkedin.com/company "${apex}"`];
    for (const brand of brandHints.slice(0, 1)) {
        if (brand && String(brand).length >= 2) {
            queries.push(`site:linkedin.com/company ${JSON.stringify(brand)}`);
        }
    }
    return queries;
}

/** Pull /company/{slug} results out of a Google SERP HTML page, in rank order. */
export function extractCompanySlugsFromSerps(html = '') {
    const out = [];
    const seen = new Set();
    for (const m of String(html).matchAll(/linkedin\.com\/company\/([A-Za-z0-9_\-.%]+)/gi)) {
        let slug;
        try { slug = decodeURIComponent(m[1]).toLowerCase(); } catch { slug = m[1].toLowerCase(); }
        slug = slug.replace(/\.+$/, '');
        if (!slug || seen.has(slug)) continue;
        seen.add(slug);
        out.push(slug);
    }
    return out;
}

export function serpLooksBlocked(html = '') {
    const h = String(html);
    return h.length < 2000 || /unusual traffic|captcha|not a robot|g-recaptcha/i.test(h);
}

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
    + '(KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36';

async function fetchSerpPage(url, proxyAgentFactory) {
    const dispatcher = await proxyAgentFactory();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20_000);
    try {
        const res = await fetch(url, {
            headers: {
                'User-Agent': BROWSER_UA,
                'Accept-Language': 'en-US,en;q=0.9',
            },
            redirect: 'follow',
            signal: ctrl.signal,
            dispatcher,
        });
        return await res.text();
    } finally {
        clearTimeout(timer);
    }
}

/**
 * @param {object} opts
 * @param {Array<string>} opts.queries          - from buildSerpQueries()
 * @param {Function} opts.proxyUrlFor           - async (sessionId) => proxy URL string from Apify ProxyConfiguration
 * @returns {Promise<{slugs: string[], blocked: boolean, requests: number}>}
 */
export async function serpRung({ queries, proxyUrlFor }) {
    const slugs = [];
    const seen = new Set();
    let blocked = false;
    let requests = 0;

    for (const q of queries.slice(0, 2)) {
        const sessionId = `cbd_serp_${Math.random().toString(36).slice(2, 10)}`;
        const url = `https://www.google.com/search?q=${encodeURIComponent(q)}&num=20&hl=en&pws=0`;
        let html = '';
        try {
            html = await fetchSerpPage(url, () => proxyUrlFor(sessionId));
        } catch {
            continue;
        } finally {
            requests += 1;
        }
        if (serpLooksBlocked(html)) { blocked = true; continue; }
        for (const slug of extractCompanySlugsFromSerps(html)) {
            if (!seen.has(slug)) { seen.add(slug); slugs.push(slug); }
        }
        if (slugs.length >= 3) break;
    }
    return { slugs, blocked, requests };
}
