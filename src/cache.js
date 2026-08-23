/**
 * Three-level resolution cache.
 *
 * L1 in-memory Map (per run) -> L2 named KV store in the buyer's account (survives runs)
 *                             -> L3 VPS persistent endpoint (optional, feature-detected).
 *
 * Buyer-facing promise enforced here: a cached resolution is NEVER billed again —
 * `charged:false` on every cached row, and main() skips the charge gate for cache hits.
 * Repeat scheduled runs are the retention play; billing them twice would kill it.
 */

export function createDomainCache({ kvStore = null, ttlDays = 30, vpsGet = null, vpsSet = null } = {}) {
    const memory = new Map();

    const keyFor = (apex) => `d:${apex}`;
    const fresh = (entry) => {
        if (!entry?.savedAt) return false;
        const ageDays = (Date.now() - Date.parse(entry.savedAt)) / 86_400_000;
        return Number.isFinite(ageDays) && ageDays <= ttlDays;
    };

    return {
        async get(apex) {
            if (memory.has(apex)) {
                const hit = { ...memory.get(apex), level: 'memory' };
                if (fresh(hit)) return hit;
            }
            if (kvStore) {
                try {
                    const fromKv = await kvStore.getValue(keyFor(apex));
                    if (fromKv && fresh(fromKv)) {
                        memory.set(apex, fromKv);
                        if (vpsSet) void vpsSet(keyFor(apex), fromKv, ttlDays).catch(() => {});
                        return { ...fromKv, level: 'kv' };
                    }
                } catch { /* KV problems never block resolution */ }
            }
            if (vpsGet) {
                try {
                    const fromVps = await vpsGet(keyFor(apex));
                    if (fromVps && fresh(fromVps)) {
                        memory.set(apex, fromVps);
                        if (kvStore) void kvStore.setValue(keyFor(apex), fromVps).catch(() => {});
                        return { ...fromVps, level: 'vps' };
                    }
                } catch { /* VPS problems never block resolution */ }
            }
            return null;
        },

        async put(apex, value) {
            const entry = { ...value, savedAt: new Date().toISOString() };
            memory.set(apex, entry);
            const jobs = [];
            if (kvStore) jobs.push(kvStore.setValue(keyFor(apex), entry).catch(() => {}));
            if (vpsSet) jobs.push(vpsSet(keyFor(apex), entry, ttlDays).catch(() => {}));
            await Promise.all(jobs);
            return entry;
        },
    };
}
