/**
 * Billing guard — ported from the flagship's run-guardrails.js / _foundation billing-guard.js.
 *
 * Two hard rules carried over from production incidents:
 *  1. Prices must be read from BOTH live shapes. `getPricingInfo()` exposes
 *     `perEventPrices` (plain numbers) on-platform and `pricingPerEvent.actorChargeEvents`
 *     via REST. The flagship shipped for months with hardcoded fallbacks because only one
 *     shape was read; the fix is to accept both and report {} honestly when neither is there.
 *  2. `Boolean({})` is true — PPE detection must test that readable prices exist, not that
 *     an object is present. Regression-tested.
 *  3. Fail closed: if a charge cannot be collected, stop emitting product rows BEFORE
 *     writing uncharged output. A buyer who got free rows never comes back.
 */

export function readActiveEventPrices(pricingInfo) {
    if (!pricingInfo || typeof pricingInfo !== 'object') return {};

    const nested = pricingInfo.pricingPerEvent?.actorChargeEvents;
    if (nested && typeof nested === 'object') {
        const out = {};
        for (const [name, ev] of Object.entries(nested)) {
            const price = Number(ev?.eventPriceUsd);
            if (Number.isFinite(price) && price >= 0) out[name] = price;
        }
        return out;
    }

    const flat = pricingInfo.perEventPrices;
    if (flat && typeof flat === 'object') {
        const out = {};
        for (const [name, price] of Object.entries(flat)) {
            const n = Number(price);
            if (Number.isFinite(n) && n >= 0) out[name] = n;
        }
        return out;
    }

    return {};
}

/** Empty object means NOT pay-per-event here. Boolean({}) is true — this is the trap. */
export function isPpeActive(pricingInfo) {
    return Object.keys(readActiveEventPrices(pricingInfo)).length > 0;
}

/**
 * @param {object} opts
 * @param {boolean} opts.isPPE          - computed by caller via isPpeActive(getChargingManager().getPricingInfo())
 * @param {string}  opts.eventName      - e.g. 'company-resolved'
 * @param {Function} opts.actorCharge   - async ({eventName, count}) => charge result from charging manager
 */
export function createChargeGate({
    isPPE = false,
    eventName = 'company-resolved',
    actorCharge,
    logger = console,
    stats = null,
} = {}) {
    let limitReached = false;

    return {
        hasChargeLimitReached: () => limitReached,

        async charge(count = 1) {
            if (!isPPE) return { canEmit: true, charged: false, reason: 'not-ppe' };
            if (limitReached) return { canEmit: false, charged: false, reason: 'charge-limit-reached' };

            if (typeof actorCharge !== 'function') {
                limitReached = true;
                logger.warning?.(`PPE charge gate failed closed: actorCharge function missing for ${eventName}.`);
                return { canEmit: false, charged: false, reason: 'charge-unavailable' };
            }

            try {
                const result = await actorCharge({ eventName, count });
                if (result?.eventChargeLimitReached) {
                    limitReached = true;
                    logger.warning?.(`PPE charge limit reached for ${eventName}; stopping billed emission before writing uncharged output.`);
                    return { canEmit: false, charged: false, reason: 'charge-limit-reached', result };
                }
                const chargedCount = Number(result?.chargedCount || 0);
                if (chargedCount <= 0) {
                    limitReached = true;
                    logger.warning?.(`PPE charge for ${eventName} collected 0 events; stopping billed emission before writing uncharged output.`);
                    return { canEmit: false, charged: false, reason: 'not-charged', result };
                }
                if (stats) stats.totalCharges = Number(stats.totalCharges || 0) + chargedCount;
                return { canEmit: true, charged: true, reason: 'charged', result };
            } catch (error) {
                limitReached = true;
                logger.warning?.(`PPE charge failed for ${eventName}; stopping billed emission before writing uncharged output: ${error.message}`);
                return { canEmit: false, charged: false, reason: 'charge-error', error };
            }
        },
    };
}
