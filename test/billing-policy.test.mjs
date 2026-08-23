import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createChargeGate, readActiveEventPrices } from '../src/guardrails.js';

/**
 * End-to-end billing policy test at the main()-level logic shape:
 * billed classes (high/medium) go through the gate; cached and low never do;
 * gate failure stops emission before uncharged product rows are written.
 */

function makeHarness() {
    const pushed = [];
    let charges = 0;
    const stats = { totalCharges: 0 };
    const gate = createChargeGate({
        isPPE: true,
        eventName: 'company-resolved',
        actorCharge: async () => {
            charges += 1;
            if (charges > 3) return { eventChargeLimitReached: true };
            return { chargedCount: 1 };
        },
        logger: { warning: () => {} },
        stats,
    });

    async function emitRow(row) {
        const isBilledClass = row.confidence === 'high' || row.confidence === 'medium';
        if (isBilledClass && !row.cached) {
            const r = await gate.charge(1);
            if (!r.canEmit) return false;
            row.charged = true;
        }
        pushed.push(row);
        return true;
    }

    return { pushed, stats, emitRow };
}

test('policy: only high/medium non-cached rows consume charges', async () => {
    const h = makeHarness();
    await h.emitRow({ confidence: 'high', cached: false });
    await h.emitRow({ confidence: 'medium', cached: false });
    await h.emitRow({ confidence: 'low', cached: false });
    await h.emitRow({ confidence: 'high', cached: true });

    assert.equal(h.stats.totalCharges, 2);
    const chargedFlags = h.pushed.map((r) => r.charged === true);
    assert.deepEqual(chargedFlags, [true, true, false, false]);
});

test('policy: charge limit reached stops emission before uncharged output', async () => {
    const h = makeHarness();
    for (let i = 0; i < 5; i++) {
        const ok = await h.emitRow({ domain: `d${i}.com`, confidence: 'high', cached: false });
        if (!ok) break;
    }
    assert.equal(h.stats.totalCharges, 3);
    assert.equal(h.pushed.length, 3);

    const prices = readActiveEventPrices({ perEventPrices: { 'company-resolved': 0.0075 } });
    assert.equal((h.stats.totalCharges * prices['company-resolved']).toFixed(4), '0.0225');
});
