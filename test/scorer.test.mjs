import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    nameSimilarity,
    domainTokenMatch,
    scoreCandidate,
    pickBest,
} from '../src/scorer.js';

const base = { apex: 'vercel.com', sld: 'vercel' };

test('nameSimilarity: exact and prefix tolerance', () => {
    assert.equal(nameSimilarity('Vercel', 'vercel'), 1);
    assert.ok(nameSimilarity('GitLab', 'gitlab com') >= 0.5);
    assert.equal(nameSimilarity('Vercel', 'Netflix'), 0);
});

test('nameSimilarity: compound names match their joined form (Product Hunt vs producthunt)', () => {
    assert.equal(nameSimilarity('Product Hunt', 'producthunt'), 1);
    assert.equal(nameSimilarity('producthunt', 'Product Hunt'), 1);
});

test('slug-probe + compound brand name now reaches medium threshold', () => {
    const r = scoreCandidate({
        apex: 'producthunt.com', sld: 'producthunt',
        brandHints: [],
        candidate: { evidence: 'slug-probe', reachable: true, pageName: 'Product Hunt', pageHtml: '' },
    });
    assert.equal(r.confidence, 'medium');
});

test('domainTokenMatch: apex or long-enough sld', () => {
    assert.equal(domainTokenMatch('vercel.com', 'vercel', 'Learn more at vercel.com'), true);
    assert.equal(domainTokenMatch('vercel.com', 'vercel', 'https://vercel.com/docs'), true);
    assert.equal(domainTokenMatch('ab.com', 'ab', 'no mention here'), false);
});

test('HIGH: sameAs + page name matches brand hint', () => {
    const r = scoreCandidate({
        ...base,
        brandHints: ['Vercel'],
        candidate: {
            evidence: 'homepage-sameas',
            reachable: true,
            pageName: 'Vercel | LinkedIn',
            pageHtml: '<title>Vercel</title>',
        },
    });
    assert.equal(r.confidence, 'high');
});

test('HIGH: sameAs + page html references the domain even without a clean name', () => {
    const r = scoreCandidate({
        ...base,
        brandHints: [],
        candidate: {
            evidence: 'homepage-sameas',
            reachable: true,
            pageName: '',
            pageHtml: 'description mentions https://vercel.com and more',
        },
    });
    assert.equal(r.confidence, 'high');
});

test('MEDIUM: slug probe with strong name match only', () => {
    const r = scoreCandidate({
        ...base,
        brandHints: ['Vercel Inc.'],
        candidate: { evidence: 'slug-probe', reachable: true, pageName: 'Vercel', pageHtml: '' },
    });
    assert.equal(r.confidence, 'medium');
});

test('LOW: slug probe whose page is about a different company (the ACME trap)', () => {
    const r = scoreCandidate({
        apex: 'acmesaas.com', sld: 'acmesaas',
        brandHints: ['Acme SaaS'],
        candidate: { evidence: 'slug-probe', reachable: true, pageName: 'Acme Steelworks', pageHtml: 'steel since 1945' },
    });
    assert.equal(r.confidence, 'low');
});

test('HIGH: serp rank-1 whose page explicitly references the domain', () => {
    const r = scoreCandidate({
        apex: 'stripe.com', sld: 'stripe',
        brandHints: [],
        candidate: {
            evidence: 'serp', reachable: true, pageName: '',
            pageHtml: 'Financial infrastructure stripe.com',
        },
    });
    assert.equal(r.confidence, 'high');
});

test('LOW: unreachable page never scores above low', () => {
    const r = scoreCandidate({
        ...base,
        brandHints: ['Vercel'],
        candidate: { evidence: 'homepage-sameas', reachable: false, pageName: '', pageHtml: '' },
    });
    assert.equal(r.confidence, 'low');
});

test('pickBest: high beats medium beats low; first wins ties', () => {
    const best = pickBest([
        { confidence: 'low' }, { confidence: 'medium' }, { confidence: 'high' },
    ]);
    assert.equal(best.confidence, 'high');
    assert.equal(pickBest([{ confidence: 'medium' }, { confidence: 'medium' }]).confidence, 'medium');
    assert.equal(pickBest([]), null);
});
