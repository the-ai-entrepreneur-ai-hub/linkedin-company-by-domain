/**
 * Monitor mode — ported from _foundation/src/snapshot-diff.js (shopify variant).
 * Free diff per monitored batch: new companies, headcount changes, name changes.
 * Snapshots live in a NAMED key-value store in the buyer's account (named stores are
 * retained indefinitely, unlike the 31-day default store).
 *
 * Truncation safety carried over: a truncated run sees only part of the batch, so its
 * "removed companies" would be fabricated — report additions only and keep the previous
 * complete snapshot.
 */

import { Actor } from 'apify';

export const SNAPSHOT_STORE_NAME = 'company-by-domain-snapshots';

export async function openSnapshotStore() {
    return Actor.openKeyValueStore(SNAPSHOT_STORE_NAME);
}

export function snapshotKey(batchId = 'default') {
    return `batch:${String(batchId || 'default')}`;
}

/** Pure diff between previous snapshot rows and this run's resolved rows. */
export function diffCompanySnapshots(previousRows = [], currentRows = []) {
    const prevByDomain = new Map(previousRows.map((r) => [r.domain, r]));
    const curByDomain = new Map(currentRows.map((r) => [r.domain, r]));

    const newCompanies = [];
    const headcountChanges = [];
    const nameChanges = [];

    for (const [domain, cur] of curByDomain) {
        if (!domain) continue;
        const prev = prevByDomain.get(domain);
        if (!prev) {
            newCompanies.push({ domain, companyName: cur.companyName, linkedinUrl: cur.linkedinUrl });
            continue;
        }
        if (
            prev.employeeCount != null && cur.employeeCount != null
            && Number(prev.employeeCount) !== Number(cur.employeeCount)
        ) {
            headcountChanges.push({
                domain,
                companyName: cur.companyName,
                previousEmployeeCount: prev.employeeCount,
                employeeCount: cur.employeeCount,
            });
        }
        if (prev.companyName && cur.companyName && prev.companyName !== cur.companyName) {
            nameChanges.push({ domain, previousCompanyName: prev.companyName, companyName: cur.companyName });
        }
    }

    const removedCompanies = previousRows
        .filter((r) => r.domain && !curByDomain.has(r.domain))
        .map((r) => ({ domain: r.domain, companyName: r.companyName }));

    return { newCompanies, removedCompanies, headcountChanges, nameChanges };
}

/**
 * Emit one free `diff-summary` row and persist this run's snapshot.
 * Only medium/high confidence rows enter snapshots; low-confidence churn would fabricate diffs.
 */
export async function emitCompanyDiff({ store, key, rows, truncated, log }) {
    const snapshotRows = rows
        .filter((r) => r.confidence !== 'low' && r.linkedinUrl)
        .map((r) => ({
            domain: r.domain,
            companyName: r.companyName || '',
            linkedinUrl: r.linkedinUrl,
            employeeCount: r.employeeCount ?? null,
        }));

    const previous = await store.getValue(key);
    const isFirstRun = !previous;
    const diff = isFirstRun
        ? { newCompanies: [], removedCompanies: [], headcountChanges: [], nameChanges: [] }
        : diffCompanySnapshots(Array.isArray(previous?.companies) ? previous.companies : [], snapshotRows);

    await Actor.pushData({
        recordType: 'diff-summary',
        ok: true,
        snapshotKey: key,
        isFirstRun,
        previousRunAt: previous?.savedAt ?? null,
        currentCompanyCount: snapshotRows.length,
        previousCompanyCount: previous?.companies?.length ?? null,
        newCompanies: diff.newCompanies.slice(0, 500),
        removedCompanies: truncated ? [] : diff.removedCompanies.slice(0, 500),
        headcountChanges: diff.headcountChanges.slice(0, 500),
        nameChanges: diff.nameChanges.slice(0, 500),
        removalsUnavailable: truncated
            ? 'run was truncated (charge limit or maxDomains cap); removal detection needs a complete run'
            : undefined,
        note: isFirstRun
            ? 'First monitored run for this batch: baseline saved. Diffs appear from the next run onward.'
            : undefined,
        comparedAt: new Date().toISOString(),
    });

    if (!truncated || isFirstRun) {
        await store.setValue(key, {
            savedAt: new Date().toISOString(),
            runId: Actor.getEnv().actorRunId ?? null,
            companies: snapshotRows,
        });
    } else {
        log?.info(`${key}: run truncated — keeping previous complete snapshot.`);
    }
    return diff;
}
