/**
 * Domain normalization: raw user input -> { apex, sld } + DNS precheck.
 *
 * Vendored Public Suffix subset (top multi-part suffixes only) instead of the full PSL
 * package: the actor's dependency budget is apify/crawlee/undici, nothing else. The
 * fallback rule (last two labels) is correct for >99% of real input; the list below
 * covers the common exceptions (co.uk, com.au, ...).
 */

const MULTIPART_SUFFIXES = new Set([
    'co.uk', 'org.uk', 'me.uk', 'ac.uk', 'gov.uk', 'ltd.uk', 'plc.uk',
    'com.au', 'net.au', 'org.au', 'edu.au', 'gov.au', 'id.au',
    'co.nz', 'net.nz', 'org.nz',
    'co.jp', 'ne.jp', 'or.jp', 'ac.jp', 'go.jp',
    'co.kr', 'or.kr',
    'co.in', 'net.in', 'org.in', 'firm.in', 'gen.in',
    'co.id', 'or.id', 'web.id', 'my.id',
    'com.br', 'net.br', 'org.br', 'gov.br',
    'com.mx', 'org.mx', 'gob.mx',
    'com.ar', 'org.ar', 'gob.ar',
    'com.co', 'org.co', 'edu.co',
    'com.pe', 'com.ve', 'com.ec', 'com.uy', 'com.py', 'com.bo',
    'co.za', 'org.za', 'net.za', 'web.za',
    'com.ng', 'org.ng', 'com.gh', 'com.ke', 'co.tz', 'com.eg', 'co.ma', 'com.tn',
    'com.tr', 'com.cn', 'net.cn', 'org.cn', 'gov.cn',
    'com.hk', 'org.hk', 'com.tw', 'org.tw', 'idv.tw',
    'com.sg', 'org.sg', 'per.sg', 'com.my', 'org.my',
    'com.ph', 'com.vn', 'com.th', 'or.th', 'co.th',
    'com.sa', 'com.qa', 'com.kw', 'com.bh', 'com.om', 'ae.org', 'net.ae', 'org.ae',
    'com.ru', 'org.ru', 'com.ua', 'net.ua', 'org.ua',
    'com.pl', 'net.pl', 'org.pl', 'com.pt', 'org.pt',
    'com.gr', 'com.cy', 'com.mt', 'com.hr', 'co.hu', 'org.hu', 'co.il', 'org.il',
    'co.at', 'or.at', 'ac.at', 'co.cz', 'com.es', 'org.es', 'com.se', 'org.se',
]);

const LABEL_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

/**
 * @param {string} raw anything a human might paste: "https://www.stripe.com/about", "STRIPE.COM"
 * @returns {{ok: true, apex: string, sld: string, tld: string} | {ok: false, reason: string}}
 */
export function extractApex(raw) {
    if (!raw || typeof raw !== 'string') return { ok: false, reason: 'empty' };
    let host = String(raw).trim().toLowerCase();
    if (!host) return { ok: false, reason: 'empty' };
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(host)) {
        try {
            const u = new URL(host);
            host = u.hostname;
        } catch {
            return { ok: false, reason: 'unparseable-url' };
        }
    } else {
        host = host.split('/')[0].split('?')[0].split('#')[0];
    }
    host = host.replace(/^\[|\]$/g, '');
    host = host.replace(/\.+$/, '');
    if (!host || host === 'localhost') return { ok: false, reason: `invalid-host:${host}` };
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return { ok: false, reason: 'ip-address' };
    const labels = host.split('.').filter(Boolean);
    if (labels.length < 2) return { ok: false, reason: 'no-tld' };
    for (const label of labels) {
        if (!LABEL_RE.test(label)) return { ok: false, reason: `bad-label:${label}` };
    }
    let take = 2;
    const penultimate = labels.slice(-2).join('.');
    if (MULTIPART_SUFFIXES.has(penultimate) && labels.length >= 3) take = 3;
    if (labels.length < take) return { ok: false, reason: 'too-short' };
    const apex = labels.slice(-take).join('.');
    const sld = labels[labels.length - take];
    return { ok: true, apex, sld, tld: labels[labels.length - 1] };
}

/**
 * Normalize + dedupe a user-supplied domain list.
 * @returns {{valid: Array<{input: string, apex: string, sld: string}>, invalid: Array<{input: string, reason: string}>}}
 */
export function normalizeDomainList(inputs = []) {
    const seen = new Map();
    const invalid = [];
    for (const raw of inputs ?? []) {
        const parsed = extractApex(raw);
        if (!parsed.ok) {
            invalid.push({ input: String(raw), reason: parsed.reason });
            continue;
        }
        if (!seen.has(parsed.apex)) {
            seen.set(parsed.apex, { input: String(raw).trim(), apex: parsed.apex, sld: parsed.sld });
        }
    }
    return { valid: [...seen.values()], invalid };
}

/** Free reachability gate before any paid rung: dead domains never cost proxy or SERP money. */
export async function dnsPrecheck(apex) {
    try {
        const dns = await import('node:dns/promises');
        try {
            await dns.resolveMx(apex);
            return 'live';
        } catch { /* fall through to A record */ }
        try {
            await dns.resolve(apex);
            return 'live';
        } catch {
            try {
                await dns.resolve(`www.${apex}`);
                return 'live';
            } catch {
                return 'dead';
            }
        }
    } catch {
        return 'unknown';
    }
}

/** Slug candidates to probe on linkedin.com/company/{slug}, cheapest first. */
export function slugCandidates(sld) {
    const base = String(sld || '').toLowerCase();
    if (!base) return [];
    const out = [base];
    const compact = base.replace(/[-_]/g, '');
    if (compact !== base) out.push(compact);
    out.push(`${base}-com`, `${base}inc`, `${base}-inc`, `${base}hq`, `${base}-hq`);
    return [...new Set(out)].slice(0, 6);
}
