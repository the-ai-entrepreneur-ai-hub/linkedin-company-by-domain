/**
 * Waterfall integration tests — resolveDomain with injected fake rungs.
 * No network, no Apify, no module mocking. Proves: stop-at-HIGH ordering,
 * cache freebies never re-resolve, dead-domain short-circuit, honest unresolved rows.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveDomain } from '../src/resolver.js';
import { createDomainCache } from '../src/cache.js';

function makeMemoryCache() {
    return createDomainCache({ kvStore: null, ttlDays: 30 });
}

const OK_PAGE = (name) => ({
    reachable: true,
    blocked: false,
    html: `<title>${name} | LinkedIn</title><p>https://acme.com</p>`,
    name,
    meta: { employeeCount: 213 },
});

test('waterfall: sameAs candidate verified HIGH stops before slug/serp rungs', async () => {
    const calls = { homepage: 0, wikidata: 0, serp: 0, pageFetches: [] };
    const row = await resolveDomain({
        domainRecord: { apex: 'deathwishcoffee.com', sld: 'deathwishcoffee' },
        cache: makeMemoryCache(),
        proxyUrlFor: async () => 'http://fake-proxy',
        deps: {
            dnsPrecheck: async () => 'live',
            vpsLaneReady: () => false,
            buildSerpQueries: (x) => [x.apex],
            homepageRung: async () => {
                calls.homepage += 1;
                return {
                    ok: true, status: 'live', html: '<html></html>',
                    brandHints: ['Death Wish Coffee'],
                    candidates: [{
                        kind: 'company', slug: 'death-wish-coffee',
                        url: 'https://www.linkedin.com/company/death-wish-coffee/',
                        evidence: 'homepage-sameas',
                    }],
                };
            },
            wikidataBrandRung: async () => { calls.wikidata += 1; return { ok: false, brands: [] }; },
            fetchLinkedInCompanyPage: async ({ url }) => {
                calls.pageFetches.push(url);
                return OK_PAGE('Death Wish Coffee');
            },
            serpRung: async () => { calls.serp += 1; return { slugs: [], blocked: false, requests: 0 }; },
            vpsRenderHomepageRung: async () => ({ ok: false, html: '', brandHints: [], candidates: [] }),
        },
    });

    assert.equal(row.confidence, 'high');
    assert.equal(row.method, 'homepage-sameas');
    assert.equal(row.employeeCount, 213);
    assert.equal(calls.homepage, 1);
    assert.equal(calls.wikidata, 0);
    assert.equal(calls.serp, 0);
    assert.equal(calls.pageFetches.length, 1);
    assert.equal(row._stats.pageFetches, 1);
});

test('waterfall: cached hit returns free row without any network', async () => {
    const cache = makeMemoryCache();
    await cache.put('vercel.com', { linkedinUrl: 'https://www.linkedin.com/company/vercel/', companyName: 'Vercel', confidence: 'high', method: 'homepage-sameas' });

    const calls = { homepage: 0, pageFetches: 0 };
    const row = await resolveDomain({
        domainRecord: { apex: 'vercel.com', sld: 'vercel' },
        cache,
        proxyUrlFor: null,
        deps: {
            dnsPrecheck: async () => { throw new Error('should not be called'); },
            vpsLaneReady: () => false,
            buildSerpQueries: () => [],
            homepageRung: async () => { calls.homepage += 1; return {}; },
            wikidataBrandRung: async () => ({ ok: false, brands: [] }),
            fetchLinkedInCompanyPage: async () => { calls.pageFetches += 1; return {}; },
            serpRung: async () => ({ slugs: [], blocked: false, requests: 0 }),
            vpsRenderHomepageRung: async () => ({ ok: false, html: '', brandHints: [], candidates: [] }),
        },
    });

    assert.equal(row.cached, true);
    assert.equal(row.charged, false);
    assert.equal(row.linkedinUrl.includes('vercel'), true);
    assert.equal(calls.homepage + calls.pageFetches, 0);
});

test('waterfall: dead domain short-circuits everything, websiteStatus=dead', async () => {
    let homepageCalled = false;
    const row = await resolveDomain({
        domainRecord: { apex: 'defunct-domain.xyz', sld: 'defunct-domain' },
        cache: makeMemoryCache(),
        proxyUrlFor: null,
        deps: {
            dnsPrecheck: async () => 'dead',
            vpsLaneReady: () => false,
            buildSerpQueries: () => [],
            homepageRung: async () => { homepageCalled = true; return {}; },
            wikidataBrandRung: async () => ({ ok: false, brands: [] }),
            fetchLinkedInCompanyPage: async () => OK_PAGE('X'),
            serpRung: async () => ({ slugs: [], blocked: false, requests: 0 }),
            vpsRenderHomepageRung: async () => ({ ok: false, html: '', brandHints: [], candidates: [] }),
        },
    });
    assert.equal(homepageCalled, false);
    assert.equal(row.websiteStatus, 'dead');
    assert.equal(row.confidence, 'low');
    assert.equal(row.charged, false);
    assert.equal(row.qualityState, 'domain-unreachable-dns');
});

test('waterfall: no evidence anywhere -> honest unresolved row, nothing cached', async () => {
    const cache = makeMemoryCache();
    const row = await resolveDomain({
        domainRecord: { apex: 'mystery.io', sld: 'mystery' },
        cache,
        proxyUrlFor: null,
        deps: {
            dnsPrecheck: async () => 'live',
            vpsLaneReady: () => false,
            buildSerpQueries: () => [],
            homepageRung: async () => ({ ok: false, status: 'dead', html: '', brandHints: [], candidates: [] }),
            wikidataBrandRung: async () => ({ ok: false, brands: [] }),
            fetchLinkedInCompanyPage: async () => ({ reachable: false, blocked: true, html: '', name: '', meta: {} }),
            serpRung: async () => ({ slugs: [], blocked: true, requests: 2 }),
            vpsRenderHomepageRung: async () => ({ ok: false, html: '', brandHints: [], candidates: [] }),
        },
    });
    assert.equal(row.confidence, 'low');
    assert.equal(row.qualityState, 'no-verified-match');
    assert.equal(await cache.get('mystery.io'), null);
});

test('waterfall: wrong-company slug probe scores LOW and is not billed as resolution', async () => {
    const row = await resolveDomain({
        domainRecord: { apex: 'acmesaas.com', sld: 'acmesaas' },
        cache: makeMemoryCache(),
        proxyUrlFor: null,
        deps: {
            dnsPrecheck: async () => 'live',
            vpsLaneReady: () => false,
            buildSerpQueries: () => [],
            homepageRung: async () => ({ ok: true, status: 'live', html: '<html>no socials here but long enough content to pass</html>', brandHints: ['Acme SaaS'], candidates: [] }),
            wikidataBrandRung: async () => ({ ok: false, brands: [] }),
            fetchLinkedInCompanyPage: async ({ url }) => OK_PAGE('Acme Steelworks'),
            serpRung: async () => ({ slugs: [], blocked: false, requests: 0 }),
            vpsRenderHomepageRung: async () => ({ ok: false, html: '', brandHints: [], candidates: [] }),
        },
    });
    assert.equal(row.confidence, 'low');
    assert.equal(row.qualityState, 'no-verified-match');
});
