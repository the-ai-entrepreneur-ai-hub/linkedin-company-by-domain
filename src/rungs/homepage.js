/**
 * R1 — homepage static fetch. Cheapest evidence there is: most corporate sites
 * self-declare their LinkedIn page in JSON-LD `sameAs[]` or a footer link.
 * Direct egress, no proxy, 10s timeout, HTML only.
 */

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
    + '(KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36';

const LINKEDIN_URL_RE = /https?:\/\/(?:[a-z]{2,4}\.)?linkedin\.com\/(company|school|showcase)\/([A-Za-z0-9_\-.%]+)/g;

export function normalizeCompanyUrl(rawUrl) {
    const m = String(rawUrl || '').match(/linkedin\.com\/(company|school|showcase)\/([A-Za-z0-9_\-.%]+)/i);
    if (!m) return null;
    let slug = decodeURIComponent(m[2]).replace(/\.+$/, '');
    if (!slug || /^home$|^feed$/i.test(slug)) return null;
    return { kind: m[1].toLowerCase(), slug: slug.toLowerCase(), url: `https://www.linkedin.com/${m[1].toLowerCase()}/${slug}/` };
}

/** Parse all JSON-LD blocks; returns Organization-ish names and every sameAs LinkedIn entry. */
export function extractJsonLdEvidence(html = '') {
    const names = [];
    const sameAs = [];
    for (const [, raw] of String(html).matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)) {
        let data;
        try { data = JSON.parse(raw.trim()); } catch { continue; }
        const nodes = Array.isArray(data?.['@graph']) ? data['@graph'] : [data];
        for (const node of nodes) {
            if (!node || typeof node !== 'object') continue;
            const types = Array.isArray(node['@type']) ? node['@type'] : [node['@type']];
            if (types.some((t) => ['Organization', 'Corporation', 'LocalBusiness', 'WebSite', 'Product', 'Brand'].includes(String(t)))) {
                if (typeof node.name === 'string' && node.name.trim()) names.push(node.name.trim());
            }
            const same = Array.isArray(node.sameAs) ? node.sameAs : (typeof node.sameAs === 'string' ? [node.sameAs] : []);
            for (const s of same) {
                const norm = normalizeCompanyUrl(s);
                if (norm) sameAs.push(norm);
            }
        }
    }
    return {
        names: [...new Set(names)].slice(0, 3),
        sameAs: sameAs.filter((x, i, a) => a.findIndex((y) => y.url === x.url) === i),
    };
}

/** Footer/body social links — weaker than sameAs (any page can link any company) but free. */
export function extractLinkedinHrefs(html = '') {
    const out = [];
    for (const [, , slug] of String(html).matchAll(LINKEDIN_URL_RE)) {
        const norm = normalizeCompanyUrl(`https://www.linkedin.com/company/${slug}`);
        if (norm) out.push(norm);
    }
    return out.filter((x, i, a) => a.findIndex((y) => y.slug === x.slug) === i);
}

export function extractOgSiteName(html = '') {
    const og = String(html).match(/<meta[^>]+property=["']og:site_name["'][^>]*content=["']([^"']+)["']/i)
        || String(html).match(/<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:site_name["']/i);
    return og?.[1]?.trim() || '';
}

async function fetchOnce(url, timeoutMs) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
        const res = await fetch(url, {
            headers: {
                'User-Agent': BROWSER_UA,
                'Accept': 'text/html,application/xhtml+xml',
                'Accept-Language': 'en-US,en;q=0.9',
            },
            redirect: 'follow',
            signal: ctrl.signal,
        });
        const ctype = res.headers.get('content-type') || '';
        if (!res.ok || !ctype.includes('html')) return null;
        const text = await res.text();
        if (!text || text.length < 200) return null;
        return text;
    } catch {
        return null;
    } finally {
        clearTimeout(timer);
    }
}

/**
 * @returns {Promise<{ok: boolean, status: 'live'|'dead'|'unknown', html: string, brandHints: string[], candidates: Array<{slug,url,kind,evidence}>}>}
 */
export async function homepageRung({ apex, timeoutMs = 10_000 }) {
    const attempts = [`https://${apex}/`, `https://www.${apex}/`];
    let html = '';
    let status = 'unknown';
    for (const url of attempts) {
        html = await fetchOnce(url, timeoutMs) || '';
        if (html) { status = 'live'; break; }
    }
    if (!html && status !== 'live') {
        const probe = await fetchOnce(attempts[0], Math.min(timeoutMs, 6000));
        if (probe) { html = probe; status = 'live'; } else { status = 'dead'; }
    }

    const ld = extractJsonLdEvidence(html);
    const hrefs = extractLinkedinHrefs(html);

    const seenSlugs = new Set();
    const candidates = [];
    for (const c of [
        ...ld.sameAs.map((x) => ({ ...x, evidence: 'homepage-sameas' })),
        ...hrefs.map((x) => ({
            ...x,
            evidence: ld.sameAs.some((s) => s.slug === x.slug) ? 'homepage-sameas' : 'homepage-link',
        })),
    ]) {
        if (seenSlugs.has(c.slug)) continue;
        seenSlugs.add(c.slug);
        candidates.push(c);
    }

    return {
        ok: Boolean(html),
        status,
        html,
        brandHints: [...new Set([...ld.names, extractOgSiteName(html)])].filter(Boolean),
        candidates,
    };
}
