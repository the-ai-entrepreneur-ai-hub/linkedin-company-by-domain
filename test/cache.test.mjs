import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDomainCache } from '../src/cache.js';

const DAY = 86_400_000;

function makeKv() {
    const data = new Map();
    return {
        data,
        async getValue(k) { return structuredClone(data.get(k)) ?? null; },
        async setValue(k, v) { data.set(k, structuredClone(v)); },
    };
}

test('cache: memory -> kv promotion and freshness window', async () => {
    const kv = makeKv();
    const cache = createDomainCache({ kvStore: kv, ttlDays: 30 });

    assert.equal(await cache.get('vercel.com'), null);
    await cache.put('vercel.com', { linkedinUrl: 'https://www.linkedin.com/company/vercel/', confidence: 'high' });

    const hit = await cache.get('vercel.com');
    assert.equal(hit.level, 'memory');
    assert.equal(hit.linkedinUrl.includes('vercel'), true);
    assert.ok(kv.data.has('d:vercel.com'));
});

test('cache: stale entries are ignored (ttl enforced)', async () => {
    const kv = makeKv();
    const cache = createDomainCache({ kvStore: kv, ttlDays: 30 });
    await cache.put('old.com', { linkedinUrl: 'x', confidence: 'high' });
    const key = 'd:old.com';
    const entry = kv.data.get(key);
    entry.savedAt = new Date(Date.now() - 40 * DAY).toISOString();

    // fresh memory bypassed by new cache instance sharing the same kv
    const cache2 = createDomainCache({ kvStore: kv, ttlDays: 30 });
    assert.equal(await cache2.get('old.com'), null);
});

test('cache: vps level backfills kv and memory', async () => {
    const kv = makeKv();
    let vpsCalls = 0;
    const stored = { linkedinUrl: 'https://www.linkedin.com/company/gitlab/', confidence: 'high', savedAt: new Date().toISOString() };
    const cache = createDomainCache({
        kvStore: kv,
        ttlDays: 30,
        vpsGet: async () => { vpsCalls += 1; return structuredClone(stored); },
        vpsSet: async () => true,
    });

    const hit = await cache.get('gitlab.com');
    assert.equal(vpsCalls, 1);
    assert.ok(hit.level === 'vps' || hit.level === 'kv');
    assert.ok(kv.data.has('d:gitlab.com'));

    const again = await cache.get('gitlab.com');
    assert.equal(again.level, 'memory');
});

test('cache: broken stores never throw out of get/put', async () => {
    const cache = createDomainCache({
        kvStore: { getValue: async () => { throw new Error('kv down'); }, setValue: async () => { throw new Error('kv down'); } },
        ttlDays: 30,
        vpsGet: async () => { throw new Error('vps down'); },
        vpsSet: async () => { throw new Error('vps down'); },
    });
    assert.equal(await cache.get('anything.com'), null);
    await assert.doesNotReject(() => cache.put('anything.com', { confidence: 'medium' }));
});
