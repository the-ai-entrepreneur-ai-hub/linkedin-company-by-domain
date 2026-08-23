/**
 * Domain resolution pipeline — pure orchestration over injected rungs/transports.
 * Free of Actor.* side effects so the whole waterfall is unit-testable: every rung
 * is overridable through the `deps` argument (defaults are the real modules).
 */

import { dnsPrecheck as realDnsPrecheck, slugCandidates } from './normalize.js';
import { homepageRung as realHomepageRung } from './rungs/homepage.js';
import { fetchLinkedInCompanyPage as realFetchLinkedInCompanyPage } from './rungs/slug.js';
import { wikidataBrandRung as realWikidataBrandRung } from './rungs/wikidata.js';
import { buildSerpQueries, serpRung as realSerpRung } from './rungs/serp.js';
import { vpsRenderHomepageRung as realVpsRenderHomepageRung } from './rungs/vps-render.js';
import { vpsReady as realVpsLaneReady } from './vps-client.js';
import { scoreCandidate, pickBest } from './scorer.js';

const MAX_VERIFICATION_FETCHES_PER_DOMAIN = 3;

const DEFAULT_DEPS = {
    homepageRung: realHomepageRung,
    wikidataBrandRung: realWikidataBrandRung,
    serpRung: realSerpRung,
    buildSerpQueries,
    vpsRenderHomepageRung: realVpsRenderHomepageRung,
    fetchLinkedInCompanyPage: realFetchLinkedInCompanyPage,
    dnsPrecheck: realDnsPrecheck,
    vpsLaneReady: realVpsLaneReady,
};

export function makeProxyUrlFor(proxyConfiguration) {
    if (!proxyConfiguration) return null;
    return async (sessionId) => proxyConfiguration.newUrl(sessionId);
}

/**
 * Resolve one domain through the waterfall.
 * @param {object} p
 * @param {{apex:string,sld:string}} p.domainRecord
 * @param {object} p.cache                 - from createDomainCache
 * @param {Function|null} p.proxyUrlFor    - async sessionId => residential proxy URL
 * @param {Function|null} p.serpProxyUrlFor
 * @param {object} [p.deps]                - rung overrides (tests)
 * @returns {object} row (with _stats; caller strips)
 */
export async function resolveDomain({
    domainRecord,
    cache,
    proxyUrlFor,
    serpProxyUrlFor,
    forceRefresh = false,
    useVpsRender = true,
    deps = DEFAULT_DEPS,
}) {
    const { apex, sld } = domainRecord;
    const stats = { pageFetches: 0, proxyRequests: 0 };

    if (!forceRefresh) {
        const hit = await cache.get(apex);
        if (hit) {
            return {
                domain: apex,
                recordType: 'company',
                linkedinUrl: hit.linkedinUrl || null,
                companyName: hit.companyName || null,
                confidence: hit.confidence || 'high',
                method: 'cache',
                employeeCount: hit.employeeCount ?? null,
                followers: hit.followers ?? null,
                location: null,
                industry: null,
                websiteStatus: 'live',
                cached: true,
                charged: false,
                qualityState: null,
                resolvedAt: hit.savedAt,
                _stats: stats,
            };
        }
    }

    const dnsStatus = await deps.dnsPrecheck(apex);
    if (dnsStatus === 'dead') {
        return {
            domain: apex, recordType: 'company', linkedinUrl: null, companyName: null,
            confidence: 'low', method: 'unresolved', employeeCount: null, followers: null,
            location: null, industry: null, websiteStatus: 'dead', cached: false, charged: false,
            qualityState: 'domain-unreachable-dns', resolvedAt: null, _stats: stats,
        };
    }

    // ---- R1 homepage static -------------------------------------------------------------
    const home = await deps.homepageRung({ apex });
    let brandHints = [...home.brandHints];

    // ---- R4 wikidata brand oracle (free; upgrades later rungs) ---------------------------
    if (!brandHints.length) {
        const wd = await deps.wikidataBrandRung({ apex });
        brandHints = wd.brands;
    }

    // ---- Verify homepage candidates (sameAs first — deliberate site intent) --------------
    const scoredCandidates = [];
    let verificationsLeft = MAX_VERIFICATION_FETCHES_PER_DOMAIN;

    const orderedCandidates = [
        ...home.candidates.filter((c) => c.evidence === 'homepage-sameas'),
        ...home.candidates.filter((c) => c.evidence === 'homepage-link'),
    ];

    for (const candidate of orderedCandidates.slice(0, 2)) {
        if (verificationsLeft <= 0) break;
        verificationsLeft -= 1;
        const page = await deps.fetchLinkedInCompanyPage({
            url: candidate.url,
            proxyUrl: proxyUrlFor ? await proxyUrlFor('cbd_v') : null,
        });
        stats.pageFetches += 1;
        scoredCandidates.push(scoreFromPage({ apex, sld, brandHints, candidate, page }));
        if (scoredCandidates.at(-1).confidence === 'high') break;
    }

    let best = pickBest(scoredCandidates);

    // ---- R5 VPS render when static homepage was empty/SPA --------------------------------
    if ((!home.ok || !orderedCandidates.length) && useVpsRender && deps.vpsLaneReady() && verificationsLeft > 0 && proxyUrlFor) {
        const rendered = await deps.vpsRenderHomepageRung({ apex, proxyUrl: await proxyUrlFor('cbd_r5') });
        if (rendered.ok) {
            stats.pageFetches += 1;
            brandHints = [...new Set([...brandHints, ...rendered.brandHints])];
            for (const candidate of rendered.candidates.filter((c) => c.evidence === 'homepage-sameas').slice(0, 1)) {
                if (verificationsLeft <= 0) break;
                verificationsLeft -= 1;
                const page = await deps.fetchLinkedInCompanyPage({
                    url: candidate.url,
                    proxyUrl: proxyUrlFor ? await proxyUrlFor('cbd_v') : null,
                });
                stats.pageFetches += 1;
                scoredCandidates.push(scoreFromPage({ apex, sld, brandHints, candidate, page }));
                best = pickBest(scoredCandidates);
            }
        }
    }

    // ---- R2 slug probe --------------------------------------------------------------------
    if ((!best || best.confidence !== 'high') && verificationsLeft > 0) {
        const brandSlugs = brandHints
            .map((b) => String(b).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''))
            .filter(Boolean);
        const slugsToTry = [...slugCandidates(sld), ...brandSlugs]
            .filter((s, i, a) => a.indexOf(s) === i)
            .slice(0, 3);

        for (const slug of slugsToTry) {
            if (verificationsLeft <= 0) break;
            if (scoredCandidates.some((sc) => sc.candidate.slug === slug)) continue;
            verificationsLeft -= 1;
            stats.proxyRequests += 1;
            const candidate = { slug, url: `https://www.linkedin.com/company/${slug}/`, evidence: 'slug-probe' };
            const page = await deps.fetchLinkedInCompanyPage({
                url: candidate.url,
                proxyUrl: proxyUrlFor ? await proxyUrlFor('cbd_v') : null,
            });
            stats.pageFetches += 1;
            scoredCandidates.push(scoreFromPage({ apex, sld, brandHints, candidate, page }));
            best = pickBest(scoredCandidates);
            if (best.confidence === 'high') break;
        }
    }

    // ---- R3 SERP --------------------------------------------------------------------------
    if ((!best || best.confidence !== 'high') && serpProxyUrlFor) {
        try {
            const queries = deps.buildSerpQueries({ apex, brandHints });
            const serp = await deps.serpRung({ queries, proxyUrlFor: serpProxyUrlFor });
            stats.proxyRequests += serp.requests;
            for (const slug of serp.slugs.slice(0, 2)) {
                if (verificationsLeft <= 0) break;
                if (scoredCandidates.some((sc) => sc.candidate.slug === slug)) continue;
                verificationsLeft -= 1;
                const candidate = { slug, url: `https://www.linkedin.com/company/${slug}/`, evidence: 'serp' };
                const page = await deps.fetchLinkedInCompanyPage({
                    url: candidate.url,
                    proxyUrl: proxyUrlFor ? await proxyUrlFor('cbd_v') : null,
                });
                stats.pageFetches += 1;
                scoredCandidates.push(scoreFromPage({ apex, sld, brandHints, candidate, page }));
                best = pickBest(scoredCandidates);
                if (best.confidence === 'high') break;
            }
        } catch { /* SERP problems never fail the run */ }
    }

    const row = {
        domain: apex,
        recordType: 'company',
        linkedinUrl: null,
        companyName: null,
        confidence: 'low',
        method: 'unresolved',
        employeeCount: null,
        followers: null,
        location: null,
        industry: null,
        websiteStatus: home.status,
        cached: false,
        charged: false,
        qualityState: null,
        resolvedAt: null,
        _stats: stats,
    };

    if (best && best.confidence !== 'low') {
        row.linkedinUrl = best.candidate.url;
        row.companyName = best.page.name || best.candidate.slug;
        row.confidence = best.confidence;
        row.method = best.candidate.evidence === 'slug-probe' ? 'slug-probe'
            : best.candidate.evidence === 'serp' ? 'serp'
                : String(best.candidate.evidence).startsWith('homepage') ? best.candidate.evidence : 'unresolved';
        row.employeeCount = best.page.meta.employeeCount ?? null;
        row.followers = best.page.meta.followers ?? null;
        row.resolvedAt = new Date().toISOString();
        row.qualityState = null;

        await cache.put(apex, {
            linkedinUrl: row.linkedinUrl,
            companyName: row.companyName,
            confidence: row.confidence,
            method: row.method,
            employeeCount: row.employeeCount,
            followers: row.followers,
        });
    } else {
        row.qualityState = 'no-verified-match';
    }

    return row;
}

function scoreFromPage({ apex, sld, brandHints, candidate, page }) {
    return {
        candidate,
        page,
        ...scoreCandidate({
            apex,
            sld,
            brandHints,
            candidate: {
                ...candidate,
                reachable: page.reachable,
                pageName: page.name,
                pageHtml: page.html?.slice(0, 200_000) || '',
            },
        }),
    };
}
