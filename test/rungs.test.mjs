import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    extractCompanySlugsFromSerps,
    buildSerpQueries,
    serpLooksBlocked,
} from '../src/rungs/serp.js';
import { buildSparqlQuery, parseSparqlResponse } from '../src/rungs/wikidata.js';
import {
    extractCompanyNameFromHtml,
    isUsableCompanyName,
    extractCompanyMetaFromHtml,
    htmlMentionsDomain,
} from '../src/rungs/slug.js';

test('serp: extracts company slugs in rank order, deduped', () => {
    const html = `<a href="https://www.linkedin.com/company/stripe">Stripe</a>
        <a href="/url?q=https://www.linkedin.com/company/stripe-payments&amp;sa=U">x</a>
        <a href="https://de.linkedin.com/company/Storj">Storj</a>`;
    assert.deepEqual(extractCompanySlugsFromSerps(html), ['stripe', 'stripe-payments', 'storj']);
});

test('serp: query builder keeps apex exact and at most one brand refinement', () => {
    const q = buildSerpQueries({ apex: 'stripe.com', brandHints: ['Stripe', 'Other'] });
    assert.equal(q.length, 2);
    assert.equal(q[0], 'site:linkedin.com/company "stripe.com"');
    assert.ok(q[1].includes('"Stripe"'));
});

test('serp: block detection', () => {
    assert.equal(serpLooksBlocked('short'), true);
    assert.equal(serpLooksBlocked('<html>unusual traffic from your computer network</html>'), true);
    assert.equal(serpLooksBlocked('<html>' + '<div>x</div>'.repeat(500) + '</html>'), false);
});

test('wikidata: SPARQL targets all four site literal variants', () => {
    const q = buildSparqlQuery('vercel.com');
    for (const v of ['https://vercel.com', 'http://vercel.com', 'https://www.vercel.com', 'http://www.vercel.com']) {
        assert.ok(q.includes(`"${v}"`));
    }
});

test('wikidata: parses label bindings', () => {
    const labels = parseSparqlResponse({
        results: { bindings: [{ orgLabel: { value: 'Vercel' } }, { orgLabel: { value: 'Vercel' } }, {}] },
    });
    assert.deepEqual(labels, ['Vercel']);
});

test('company page: display-name extraction with LinkedIn title suffixes stripped', () => {
    assert.equal(extractCompanyNameFromHtml('<title>Vercel - Overview | LinkedIn</title>'), 'Vercel');
    assert.equal(extractCompanyNameFromHtml('<meta property="og:title" content="GitLab | LinkedIn">'), 'GitLab');
    assert.equal(isUsableCompanyName('Join LinkedIn'), false);
    assert.equal(isUsableCompanyName('Page not found'), false);
});

test('company page: employeeCount and followers scraped where present (K/M suffixes parsed)', () => {
    const meta = extractCompanyMetaFromHtml('<span>1,234 employees on LinkedIn</span><span>45.6K followers</span>');
    assert.equal(meta.employeeCount, 1234);
    assert.equal(meta.followers, 45600);
});

test('company page: html mentions domain (mutual evidence input)', () => {
    assert.equal(htmlMentionsDomain('<p>visit vercel.com</p>', { apex: 'vercel.com', sld: 'vercel' }), true);
    assert.equal(htmlMentionsDomain('<p>nothing</p>', { apex: 'vercel.com', sld: 'vercel' }), false);
});
