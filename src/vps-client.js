/**
 * VPS client — trimmed port of the flagship's src/vps-client.js.
 *
 * The VPS (crawl4ai-browser-gateway) is an OPTIONAL enhancement lane: TLS-fingerprinted
 * fetches and JS rendering for SPA homepages / challenged LinkedIn reads. The actor is
 * fully functional without it — every caller must go through vpsReady() first.
 *
 * Env vars (optional):
 *   VPS_URL        e.g. https://207.244.243.1
 *   VPS_API_KEY    long random string set on the gateway
 */

import { log } from 'crawlee';

let insecureDispatcher;
async function getDispatcher() {
    if (insecureDispatcher) return insecureDispatcher;
    const { Agent } = await import('undici');
    insecureDispatcher = new Agent({ connect: { rejectUnauthorized: false } });
    return insecureDispatcher;
}

const VPS_URL = (process.env.VPS_URL || '').replace(/\/$/, '');
const VPS_API_KEY = process.env.VPS_API_KEY || '';

export function vpsReady() {
    return Boolean(VPS_URL && VPS_API_KEY);
}

async function vpsCall(path, body, { timeoutMs = 60_000 } = {}) {
    const dispatcher = await getDispatcher();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
        const res = await fetch(`${VPS_URL}${path}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-API-Key': VPS_API_KEY },
            body: JSON.stringify(body),
            signal: ctrl.signal,
            dispatcher,
        });
        const text = await res.text();
        let json;
        try { json = text ? JSON.parse(text) : {}; } catch { json = { body: text }; }
        return { status: res.status, json };
    } finally {
        clearTimeout(timer);
    }
}

/**
 * Fetch a URL through /tls/fetch with a Chrome TLS fingerprint.
 * @returns { status, body, headers, final_url, duration_ms, cookie_count }
 */
export async function tlsFetch({ url, sessionId, profile = 'chrome_124', proxy, headers, method = 'GET', body, timeout = 30 }) {
    if (!vpsReady()) throw new Error('VPS_URL or VPS_API_KEY not configured');

    const { status: httpStatus, json } = await vpsCall('/tls/fetch', {
        url,
        method,
        headers,
        body,
        profile,
        proxy,
        timeout,
        session_id: sessionId,
    }, { timeoutMs: (timeout + 10) * 1000 });

    if (httpStatus !== 200) throw new Error(`/tls/fetch HTTP ${httpStatus}: ${JSON.stringify(json)}`);
    if (json.error) throw new Error(`/tls/fetch app error: ${json.error}`);
    return json;
}

/**
 * Browser-rendered page through /crawl. May classify a page as blocked while still
 * returning useful HTML — callers inspect html before treating metadata as fatal.
 */
export async function crawlPage({ url, headers, proxy, timeout = 45 }) {
    if (!vpsReady()) throw new Error('VPS_URL or VPS_API_KEY not configured');

    const { status: httpStatus, json } = await vpsCall('/crawl', {
        url,
        stage: 'lightweight',
        use_llm: false,
        navigation_timeout_ms: timeout * 1000,
        wait_until: 'domcontentloaded',
        headers,
        capture_html: true,
        capture_screenshot: false,
        capture_console: false,
        capture_network: false,
        proxy: proxy ? { upstreamUrl: proxy } : undefined,
    }, { timeoutMs: (timeout + 15) * 1000 });

    if (httpStatus !== 200) throw new Error(`/crawl HTTP ${httpStatus}: ${JSON.stringify(json)}`);
    if (!json || typeof json !== 'object') throw new Error(`/crawl invalid response`);
    return json;
}

/** Persistent resolution cache on the gateway host. Feature-detected: a 404 disables it for the whole run. */
const cacheState = { available: null };

export async function vpsCacheGet(key) {
    if (!vpsReady() || cacheState.available === false) return null;
    try {
        const dispatcher = await getDispatcher();
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 5000);
        const res = await fetch(`${VPS_URL}/cache/v1/get?key=${encodeURIComponent(key)}`, {
            headers: { 'X-API-Key': VPS_API_KEY },
            signal: ctrl.signal,
            dispatcher,
        }).finally(() => clearTimeout(timer));
        if (res.status === 404 && cacheState.available === null) {
            cacheState.available = false;
            log.info('VPS cache endpoint not present; continuing without persistent cache.');
            return null;
        }
        if (!res.ok) return null;
        cacheState.available = true;
        const json = await res.json().catch(() => null);
        return json?.value ?? null;
    } catch {
        return null;
    }
}

export async function vpsCacheSet(key, value, ttlDays = 30) {
    if (!vpsReady() || cacheState.available === false) return false;
    try {
        const dispatcher = await getDispatcher();
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 5000);
        const res = await fetch(`${VPS_URL}/cache/v1/set`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-API-Key': VPS_API_KEY },
            body: JSON.stringify({ key, value, ttlDays }),
            signal: ctrl.signal,
            dispatcher,
        }).finally(() => clearTimeout(timer));
        if (res.status === 404 && cacheState.available === null) {
            cacheState.available = false;
            return false;
        }
        cacheState.available = res.ok;
        return res.ok;
    } catch {
        return false;
    }
}

export async function deleteSession(sessionId) {
    if (!vpsReady() || !sessionId) return;
    try {
        await vpsCall('/tls/session/delete', { session_id: sessionId }, { timeoutMs: 5000 });
    } catch (e) {
        log.debug(`session delete failed for ${sessionId}: ${e.message}`);
    }
}

/** Test seam. */
export function _resetCacheFeatureDetect() {
    cacheState.available = null;
}
