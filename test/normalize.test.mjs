import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractApex, normalizeDomainList, slugCandidates } from '../src/normalize.js';

test('extractApex: plain domains', () => {
    const r = extractApex('vercel.com');
    assert.equal(r.ok, true);
    assert.equal(r.apex, 'vercel.com');
    assert.equal(r.sld, 'vercel');
});

test('extractApex: url with protocol, www, path, query', () => {
    const r = extractApex('https://www.stripe.com/about?x=1');
    assert.equal(r.ok, true);
    assert.equal(r.apex, 'stripe.com');
});

test('extractApex: multipart suffix co.uk takes three labels', () => {
    const r = extractApex('www.bbc.co.uk/news');
    assert.equal(r.ok, true);
    assert.equal(r.apex, 'bbc.co.uk');
    assert.equal(r.sld, 'bbc');
});

test('extractApex: com.au storefront', () => {
    const r = extractApex('culturekings.com.au');
    assert.equal(r.ok, true);
    assert.equal(r.apex, 'culturekings.com.au');
});

test('extractApex: uppercase input normalized', () => {
    const r = extractApex('GITLAB.COM/');
    assert.equal(r.ok, true);
    assert.equal(r.apex, 'gitlab.com');
});

test('extractApex: rejects junk', () => {
    assert.equal(extractApex('').ok, false);
    assert.equal(extractApex('localhost').ok, false);
    assert.equal(extractApex('192.168.1.1').ok, false);
    assert.equal(extractApex('notadomain').ok, false);
    assert.equal(extractApex('-bad-.com').ok, false);
});

test('normalizeDomainList: dedupes by apex keeping first input', () => {
    const { valid, invalid } = normalizeDomainList([
        'stripe.com', 'https://www.stripe.com/docs', 'STRIPE.COM', 'not a domain',
    ]);
    assert.equal(valid.length, 1);
    assert.equal(valid[0].apex, 'stripe.com');
    assert.equal(invalid.length, 1);
    assert.match(invalid[0].reason, /^bad-label|^no-tld/);
});

test('slugCandidates: compact + common variants, deduped, capped', () => {
    const slugs = slugCandidates('notion-hq');
    assert.ok(slugs.includes('notion-hq'));
    assert.ok(slugs.includes('notionhq'));
    assert.ok(slugs.includes('notion-hq-com'));
    assert.equal(new Set(slugs).size, slugs.length);
    assert.ok(slugs.length <= 6);
});
