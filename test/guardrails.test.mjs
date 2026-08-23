import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readActiveEventPrices, isPpeActive, createChargeGate } from '../src/guardrails.js';

test('readActiveEventPrices: REST nested shape', () => {
    const prices = readActiveEventPrices({
        pricingPerEvent: { actorChargeEvents: { 'company-resolved': { eventPriceUsd: 0.0075 }, 'actor-start': { eventPriceUsd: 0.002 } } },
    });
    assert.deepEqual(prices, { 'company-resolved': 0.0075, 'actor-start': 0.002 });
});

test('readActiveEventPrices: SDK plain perEventPrices shape', () => {
    const prices = readActiveEventPrices({ perEventPrices: { 'company-resolved': 0.0075 } });
    assert.deepEqual(prices, { 'company-resolved': 0.0075 });
});

test('readActiveEventPrices: reports {} honestly when neither shape exists (no fallbacks)', () => {
    assert.deepEqual(readActiveEventPrices({}), {});
    assert.deepEqual(readActiveEventPrices(null), {});
    assert.deepEqual(readActiveEventPrices({ pricingPerEvent: {} }), {});
});

test('isPpeActive: Boolean({}) is true — empty object must be NOT ppe (regression)', () => {
    assert.equal(isPpeActive({ perEventPrices: {} }), false);
    assert.equal(isPpeActive({}), false);
    assert.equal(isPpeActive(null), false);
    assert.equal(isPpeActive({ perEventPrices: { x: 1 } }), true);
});

function makeLogger() {
    const warnings = [];
    return { warnings, warning: (m) => warnings.push(m) };
}

test('charge gate: happy path charges and emits', async () => {
    let calls = 0;
    const gate = createChargeGate({
        isPPE: true,
        eventName: 'company-resolved',
        actorCharge: async () => { calls += 1; return { chargedCount: 1 }; },
    });
    const r = await gate.charge();
    assert.equal(r.canEmit, true);
    assert.equal(r.charged, true);
    assert.equal(calls, 1);
});

test('charge gate: limit reached stops emission BEFORE uncharged output (fail closed)', async () => {
    let calls = 0;
    const gate = createChargeGate({
        isPPE: true,
        eventName: 'company-resolved',
        actorCharge: async () => { calls += 1; return { eventChargeLimitReached: true }; },
        logger: makeLogger(),
    });
    const r = await gate.charge();
    assert.equal(r.canEmit, false);
    const r2 = await gate.charge();
    assert.equal(r2.reason, 'charge-limit-reached');
    assert.equal(calls, 1);
});

test('charge gate: charge error fails closed, never emits free product rows', async () => {
    const gate = createChargeGate({
        isPPE: true,
        eventName: 'company-resolved',
        actorCharge: async () => { throw new Error('platform hiccup'); },
        logger: makeLogger(),
    });
    const r = await gate.charge();
    assert.equal(r.canEmit, false);
    assert.equal(r.reason, 'charge-error');
});

test('charge gate: not-ppe mode emits without charging', async () => {
    const gate = createChargeGate({ isPPE: false, eventName: 'company-resolved', actorCharge: async () => { throw new Error('should not be called'); } });
    const r = await gate.charge();
    assert.equal(r.canEmit, true);
    assert.equal(r.charged, false);
});
