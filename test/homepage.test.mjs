import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    normalizeCompanyUrl,
    extractJsonLdEvidence,
    extractLinkedinHrefs,
    extractOgSiteName,
} from '../src/rungs/homepage.js';

test('normalizeCompanyUrl: strips language subdomains, trailing slashes, casing', () => {
    const r = normalizeCompanyUrl('https://www.linkedin.com/company/vercel/');
    assert.equal(r.slug, 'vercel');
    assert.equal(r.kind, 'company');
    assert.equal(r.url, 'https://www.linkedin.com/company/vercel/');

    const de = normalizeCompanyUrl('https://de.linkedin.com/company/GitLab');
    assert.equal(de.slug, 'gitlab');
});

test('normalizeCompanyUrl: rejects junk slugs', () => {
    assert.equal(normalizeCompanyUrl('https://www.linkedin.com/company/home'), null);
    assert.equal(normalizeCompanyUrl('https://www.linkedin.com/feed/'), null);
});

test('extractJsonLdEvidence: finds sameAs array and organization name', () => {
    const html = `<!doctype html><html><head>
        <script type="application/ld+json">
        {"@context":"https://schema.org","@type":"Organization","name":"Death Wish Coffee",
         "sameAs":["https://www.linkedin.com/company/death-wish-coffee","https://twitter.com/deathwishcoffee"]}
        </script></head></html>`;
    const ev = extractJsonLdEvidence(html);
    assert.deepEqual(ev.names, ['Death Wish Coffee']);
    assert.equal(ev.sameAs.length, 1);
    assert.equal(ev.sameAs[0].slug, 'death-wish-coffee');
});

test('extractJsonLdEvidence: @graph nodes and string sameAs', () => {
    const html = `<script type="application/ld+json">
        {"@graph":[{"@type":"WebSite","name":"Acme"},
                   {"@type":"Organization","name":"Acme Corp","sameAs":"https://linkedin.com/company/acme-corp"}]}
        </script>`;
    const ev = extractJsonLdEvidence(html);
    assert.ok(ev.names.includes('Acme Corp'));
    assert.equal(ev.sameAs[0].slug, 'acme-corp');
});

test('extractJsonLdEvidence: survives malformed json', () => {
    const ev = extractJsonLdEvidence('<script type="application/ld+json">{broken</script>');
    assert.deepEqual(ev.names, []);
    assert.deepEqual(ev.sameAs, []);
});

test('extractLinkedinHrefs: footer links deduped against each other', () => {
    const html = `
        <a href="https://www.linkedin.com/company/stripe">LinkedIn</a>
        <a href="http://linkedin.com/company/stripe?trk=footer">again</a>
        <a href="https://www.linkedin.com/company/someone-else/">other</a>`;
    const hrefs = extractLinkedinHrefs(html);
    assert.equal(hrefs.length, 2);
    assert.deepEqual(hrefs.map((h) => h.slug).sort(), ['someone-else', 'stripe']);
});

test('extractOgSiteName', () => {
    assert.equal(extractOgSiteName('<meta property="og:site_name" content="Vercel">'), 'Vercel');
    assert.equal(extractOgSiteName('<html>nothing</html>'), '');
});
