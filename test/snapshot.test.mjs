import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diffCompanySnapshots, snapshotKey } from '../src/snapshot.js';

const prev = [
    { domain: 'a.com', companyName: 'A', linkedinUrl: 'https://www.linkedin.com/company/a/', employeeCount: 100 },
    { domain: 'b.com', companyName: 'B', linkedinUrl: 'https://www.linkedin.com/company/b/', employeeCount: 50 },
    { domain: 'gone.com', companyName: 'Gone', linkedinUrl: 'https://www.linkedin.com/company/gone/' },
];
const cur = [
    { domain: 'a.com', companyName: 'A', linkedinUrl: 'https://www.linkedin.com/company/a/', employeeCount: 120 },
    { domain: 'b.com', companyName: 'Bee Corp', linkedinUrl: 'https://www.linkedin.com/company/b/', employeeCount: 50 },
    { domain: 'new.com', companyName: 'New', linkedinUrl: 'https://www.linkedin.com/company/new/' },
];

test('diff: headcount change, rename, additions, removals', () => {
    const d = diffCompanySnapshots(prev, cur);
    assert.deepEqual(d.headcountChanges, [{ domain: 'a.com', companyName: 'A', previousEmployeeCount: 100, employeeCount: 120 }]);
    assert.deepEqual(d.nameChanges, [{ domain: 'b.com', previousCompanyName: 'B', companyName: 'Bee Corp' }]);
    assert.deepEqual(d.newCompanies.map((x) => x.domain), ['new.com']);
    assert.deepEqual(d.removedCompanies.map((x) => x.domain), ['gone.com']);
});

test('diff: baseline semantics live at the emit layer (previous=null), pure diff reports all-new', () => {
    // emitCompanyDiff guards isFirstRun before calling this; the pure function must stay
    // honest for the legit case "previous run resolved nothing, now resolves 3".
    const d = diffCompanySnapshots([], cur);
    assert.deepEqual(d.newCompanies.map((x) => x.domain), ['a.com', 'b.com', 'new.com']);
    assert.equal(d.headcountChanges.length, 0);
});

test('diff: identical runs produce zero changes', () => {
    const d = diffCompanySnapshots(prev, prev);
    assert.equal(d.headcountChanges.length + d.newCompanies.length + d.removedCompanies.length + d.nameChanges.length, 0);
});

test('snapshotKey namespacing', () => {
    assert.equal(snapshotKey('q4'), 'batch:q4');
    assert.equal(snapshotKey(), 'batch:default');
});
