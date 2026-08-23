/**
 * LinkedIn Company Finder by Domain — Actor entry point.
 * All resolution logic lives in resolver.js (unit-testable, no Actor.* calls).
 */

import { Actor } from 'apify';
import { log } from 'crawlee';

import { readActiveEventPrices, isPpeActive, createChargeGate } from './guardrails.js';
import { openSnapshotStore, snapshotKey, emitCompanyDiff } from './snapshot.js';
import { vpsReady, vpsCacheGet, vpsCacheSet } from './vps-client.js';
import { createDomainCache } from './cache.js';
import { resolveDomain, makeProxyUrlFor } from './resolver.js';
import { normalizeDomainList } from './normalize.js';

async function mapWithConcurrency(items, limit, worker) {
    const results = new Array(items.length);
    let cursor = 0;
    async function lane() {
        while (cursor < items.length) {
            const idx = cursor++;
            results[idx] = await worker(items[idx], idx);
        }
    }
    await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, () => lane()));
    return results;
}

Actor.main(async () => {
    const input = (await Actor.getInput()) || {};
    const {
        domains = [],
        mode = 'resolve',
        monitorBatchId = 'default',
        forceRefresh = false,
        cacheTtlDays = 30,
        includeUnresolved = true,
        maxDomains = 1000,
        concurrency = 10,
        useVpsRender = true,
    } = input;

    const chargingManager = Actor.getChargingManager();
    const pricingInfo = chargingManager?.getPricingInfo?.();
    const prices = readActiveEventPrices(pricingInfo);
    const ppeActive = isPpeActive(pricingInfo);
    log.info(`Pricing read: PPE=${ppeActive} events=${JSON.stringify(prices)}`);

    const stats = {
        totalCharges: 0,
        pageFetches: 0,
        proxyRequests: 0,
        chargedRows: 0,
        cachedHits: 0,
        unresolved: 0,
        byConfidence: { high: 0, medium: 0, low: 0 },
    };
    const gate = createChargeGate({
        isPPE: ppeActive,
        eventName: 'company-resolved',
        actorCharge: ({ eventName, count }) => chargingManager.charge({ eventName, count }),
        logger: log,
        stats,
    });

    const { valid, invalid } = normalizeDomainList(domains);
    if (invalid.length) {
        log.warning(`${invalid.length} invalid domain entries skipped (first: ${invalid[0]?.input} — ${invalid[0]?.reason})`);
    }
    const worklist = valid.slice(0, maxDomains);
    const truncated = valid.length > worklist.length;
    log.info(`Worklist: ${worklist.length} domains${truncated ? ` (${valid.length} supplied, capped at ${maxDomains})` : ''}`);

    if (!worklist.length) {
        log.info('Nothing to do.');
        return;
    }

    const kvStore = await Actor.openKeyValueStore('company-by-domain-cache');
    const cache = createDomainCache({
        kvStore,
        ttlDays: cacheTtlDays,
        vpsGet: useVpsRender ? vpsCacheGet : null,
        vpsSet: useVpsRender ? vpsCacheSet : null,
    });

    let proxyConfiguration = null;
    try {
        proxyConfiguration = await Actor.createProxyConfiguration(
            input.proxyConfiguration && typeof input.proxyConfiguration === 'object'
                ? { ...input.proxyConfiguration }
                : { useApifyProxy: true },
        );
    } catch (e) {
        log.warning(`Proxy configuration unavailable (${e.message}); LinkedIn page verification will be limited.`);
    }
    const residentialProxyUrlFor = makeProxyUrlFor(proxyConfiguration);

    let serpProxyConfiguration = null;
    try {
        serpProxyConfiguration = await Actor.createProxyConfiguration({
            useApifyProxy: true,
            groups: ['GOOGLE_SERP'],
        });
    } catch { /* SERP lane optional */ }
    const serpProxyUrlFor = makeProxyUrlFor(serpProxyConfiguration);

    if (!vpsReady()) {
        log.info('VPS lane not configured — running Apify-native (TLS render / persistent cache lanes off).');
    }

    const rows = [];
    let chargeLimitHit = false;

    await mapWithConcurrency(worklist, concurrency, async (domainRecord) => {
        if (chargeLimitHit) return;
        try {
            const row = await resolveDomain({
                domainRecord,
                cache,
                proxyUrlFor: residentialProxyUrlFor,
                serpProxyUrlFor,
                forceRefresh,
                useVpsRender,
            });
            stats.pageFetches += row._stats?.pageFetches ?? 0;
            stats.proxyRequests += row._stats?.proxyRequests ?? 0;
            delete row._stats;

            const isBilledClass = row.confidence === 'high' || row.confidence === 'medium';

            if (row.cached) stats.cachedHits += 1;

            if (isBilledClass && !row.cached) {
                const chargeResult = await gate.charge(1);
                if (!chargeResult.canEmit) {
                    chargeLimitHit = true;
                    log.warning(`Charge gate stopped emission at ${stats.chargedRows} billed rows (${chargeResult.reason}). Remaining domains skipped without output.`);
                    return;
                }
                row.charged = chargeResult.charged;
                stats.chargedRows += 1;
            } else if (!isBilledClass) {
                stats.unresolved += 1;
            }

            stats.byConfidence[row.confidence] += 1;
            rows.push(row);
            if (isBilledClass || includeUnresolved) await Actor.pushData(row);
        } catch (e) {
            log.error(`resolve failed for ${domainRecord.apex}: ${e.message}`);
            stats.unresolved += 1;
            if (includeUnresolved) {
                await Actor.pushData({
                    domain: domainRecord.apex, recordType: 'company', linkedinUrl: null, companyName: null,
                    confidence: 'low', method: 'unresolved', employeeCount: null, followers: null,
                    location: null, industry: null, websiteStatus: 'unknown',
                    cached: false, charged: false, qualityState: 'error',
                    resolvedAt: null,
                }).catch(() => {});
            }
        }
    });

    if (mode === 'monitor' && rows.length) {
        try {
            const store = await openSnapshotStore();
            const key = snapshotKey(monitorBatchId);
            await emitCompanyDiff({ store, key, rows, truncated: truncated || chargeLimitHit, log });
        } catch (e) {
            log.error(`monitor diff failed: ${e.message}`);
        }
    }

    const perRow = prices['company-resolved'] ?? 0;
    log.info([
        `Summary: ${rows.length} processed`,
        `| high=${stats.byConfidence.high} medium=${stats.byConfidence.medium} low=${stats.byConfidence.low}`,
        `| charged=${stats.chargedRows} ($${(stats.chargedRows * perRow).toFixed(4)})`,
        `| cached=${stats.cachedHits} free`,
        `| pageFetches=${stats.pageFetches} proxyReqs=${stats.proxyRequests}`,
    ].join(' '));

    if (chargeLimitHit) {
        log.warning('Run ended early: charge limit reached. Raise maxTotalChargeUsd or split the batch into multiple runs.');
    }
});
