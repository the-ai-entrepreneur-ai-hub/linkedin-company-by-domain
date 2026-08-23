/**
 * R2 — slug probe: try linkedin.com/company/{sld} directly through a residential session.
 * A page that exists is weak evidence on its own (ACME the SaaS vs Acme Corp the steelmaker),
 * so this rung NEVER produces HIGH alone — it feeds the scorer with the page's display name
 * and, when present, the page's own website field for mutual-evidence checks.
 *
 * Port of the flagship's logged-out company-page extraction (company-name.js), which is the
 * V=0.86 verified engine.
 */

import { randomUUID } from 'node:crypto';
import { tlsFetch, crawlPage } from '../vps-client.js';

/** LinkedIn suffixes its titles: "Notion | LinkedIn", "Vercel - Overview | LinkedIn". */
function cleanTitle(s) {
    return String(s)
        .replace(/\s*\|\s*LinkedIn\s*$/i, '')
        .replace(/\s*[-–]\s*(Overview|Company Profile|Jobs|Posts|About)\s*$/i, '')
        .replace(/&amp;/g, '&')
        .trim();
}

export function extractCompanyNameFromHtml(html = '') {
    if (!html) return '';
    for (const [, raw] of String(html).matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)) {
        let data;
        try { data = JSON.parse(raw.trim()); } catch { continue; }
        const nodes = Array.isArray(data?.['@graph']) ? data['@graph'] : [data];
        for (const node of nodes) {
            const types = Array.isArray(node?.['@type']) ? node['@type'] : [node?.['@type']];
            if (types.includes('Organization') && typeof node.name === 'string' && node.name.trim()) {
                return node.name.trim();
            }
        }
    }
    const og = String(html).match(/<meta[^>]+property="og:title"[^>]*content="([^"]+)"/i);
    if (og?.[1]) return cleanTitle(og[1]);
    const title = String(html).match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (title?.[1]) return cleanTitle(title[1]);
    return '';
}

export function isUsableCompanyName(name) {
    if (!name || typeof name !== 'string') return false;
    const n = name.trim();
    if (n.length < 2 || n.length > 60) return false;
    if (/sign\s*up|log\s*in\s*$|join linkedin|page not found|\b404\b|just a moment|authwall/i.test(n)) return false;
    return true;
}

/** Pull employeeCount / followers / website out of logged-out company page HTML where present. */
function parseCountWithSuffix(raw) {
    const m = String(raw).match(/^([\d,.]+)\s*([KMB])?$/i);
    if (!m) {
        const n = Number(String(raw).replace(/[.,]/g, ''));
        return Number.isFinite(n) ? n : null;
    }
    let n = Number(m[1].replace(/,/g, ''));
    if (!Number.isFinite(n)) return null;
    const suffix = m[2]?.toUpperCase();
    if (suffix === 'K') n *= 1_000;
    else if (suffix === 'M') n *= 1_000_000;
    else if (suffix === 'B') n *= 1_000_000_000;
    else n = Number(String(m[1]).replace(/[.,]/g, '')) || Math.round(n);
    return Math.round(n);
}

export function extractCompanyMetaFromHtml(html = '') {
    const meta = {};
    const range = String(html).match(/([\d,.]+\s*[KMB]?)\s*(?:employees|members)\s+on\s+LinkedIn/i)
        || String(html).match(/"employeeCount"\s*:\s*"?(\d[\d,.]*)"?/i)
        || String(html).match(/Company size[^<]*<[^>]*>\s*([\d,.]+\+?)/i);
    if (range) {
        const num = parseCountWithSuffix(range[1].replace(/\+/g, ''));
        if (Number.isFinite(num)) meta.employeeCount = num;
    }
    const followers = String(html).match(/([\d,.]+\s*[KMB]?)\s*followers/i)
        || String(html).match(/"followersCount"[^\d]*(\d[\d,.]*)/i);
    if (followers) {
        const num = parseCountWithSuffix(followers[1]);
        if (Number.isFinite(num)) meta.followers = num;
    }
    return meta;
}

export function htmlMentionsDomain(html = '', { apex = '', sld = '' } = {}) {
    if (!html) return false;
    const h = String(html).toLowerCase();
    if (apex && h.includes(apex.toLowerCase())) return true;
    if (sld && sld.length >= 4) {
        const re = new RegExp(`https?://(?:www\\.)?${sld.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.`);
        if (re.test(h)) return true;
    }
    return false;
}

/**
 * Fetch one LinkedIn company page. Prefers the VPS TLS lane (Chrome fingerprint through
 * residential proxy); falls back to the browser /crawl lane; returns inconclusive otherwise.
 * @returns {Promise<{reachable: boolean, blocked: boolean, html: string, name: string, meta: object}>}
 */
export async function fetchLinkedInCompanyPage({ url, proxyUrl }) {
    if (!proxyUrl) return { reachable: false, blocked: false, html: '', name: '', meta: {} };

    if (typeof proxyUrl === 'object' && proxyUrl.tlsFetch) {
        // injected transport (tests)
        return proxyUrl.fetch({ url });
    }

    const sessionId = `cbd_${randomUUID().replace(/-/g, '')}`;
    try {
        const res = await tlsFetch({
            url,
            sessionId,
            proxy: proxyUrl,
            headers: { 'Accept-Language': 'en-US,en;q=0.9' },
            timeout: 20,
        });
        const html = res?.body ?? res?.html ?? res?.content ?? '';
        const blocked = /authwall|challenge|captcha|999/i.test(String(res?.final_url || '')) || (!html && res?.status !== 200);
        const name = extractCompanyNameFromHtml(html);
        return {
            reachable: Boolean(html) && !blocked,
            blocked,
            html,
            name: isUsableCompanyName(name) ? name : '',
            meta: extractCompanyMetaFromHtml(html),
        };
    } catch {
        try {
            const rendered = await crawlPage({ url, proxy: proxyUrl, timeout: 40 });
            const html = rendered?.html || rendered?.body || '';
            const name = extractCompanyNameFromHtml(html);
            return {
                reachable: Boolean(html),
                blocked: !html,
                html,
                name: isUsableCompanyName(name) ? name : '',
                meta: extractCompanyMetaFromHtml(html),
            };
        } catch {
            return { reachable: false, blocked: true, html: '', name: '', meta: {} };
        }
    } finally {
        const { deleteSession } = await import('../vps-client.js');
        try { await deleteSession(sessionId); } catch { /* pool reaps anyway */ }
    }
}
