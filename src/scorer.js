/**
 * Confidence scorer — pure functions, no I/O. This is where wrong-company rows die
 * before billing, which is the product.
 *
 * Evidence model:
 *   HIGH   requires mutual evidence: the SITE points at the page (sameAs/footer) AND the
 *          PAGE agrees (name matches a brand hint, or page HTML references the domain).
 *   MEDIUM allows one-sided but specific agreement (page exists + strong name match, or
 *          SERP rank-1 + decent name match). Never billed as "verified" in copy, but
 *          billable — it is still a resolution.
 *   LOW    everything else. Emitted free, never charged.
 */

const STRONG_SITE_EVIDENCE = new Set(['homepage-sameas']);
const WEAK_SITE_EVIDENCE = new Set(['homepage-link']);

export function tokenize(s) {
    return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ').filter(Boolean);
}

/** Token-set similarity 0..1 with prefix tolerance ("gitlab" vs "gitlab com")
 *  and compound-name tolerance ("Product Hunt" vs "producthunt"). */
export function nameSimilarity(a, b) {
    const ta = [...new Set(tokenize(a))];
    const tb = [...new Set(tokenize(b))];
    if (!ta.length || !tb.length) return 0;
    let hits = 0;
    for (const x of ta) {
        if (tb.includes(x)) { hits += 1; continue; }
        if (tb.some((y) => (x.length >= 4 && y.startsWith(x)) || (y.length >= 4 && x.startsWith(y)))) hits += 0.5;
    }
    let score = hits / Math.max(ta.length, tb.length);
    // Compound tolerance: multi-token name joined equals the other side's single token
    // ("product hunt" -> "producthunt"). Only ever raises toward 1, never lowers.
    if (score < 1 && ta.length > 1) {
        const joined = ta.join('');
        if (tb.includes(joined)) score = Math.max(score, 1);
    } else if (score < 1 && tb.length > 1) {
        const joinedB = tb.join('');
        if (ta.includes(joinedB)) score = Math.max(score, 1);
    }
    return score;
}

export function domainTokenMatch(apex = '', sld = '', text = '') {
    if (!text) return false;
    const h = String(text).toLowerCase();
    if (apex && h.includes(String(apex).toLowerCase())) return true;
    if (sld && sld.length >= 4) return h.includes(String(sld).toLowerCase());
    return false;
}

/**
 * @param {object} p
 * @param {string} p.apex            stripe.com
 * @param {string} p.sld             stripe
 * @param {string[]} p.brandHints    names harvested from homepage JSON-LD / og / wikidata
 * @param {object} p.candidate       {slug, url, evidence: 'homepage-sameas'|'homepage-link'|'slug-probe'|'serp', pageName, pageHtml?, reachable}
 * @returns {{confidence: 'high'|'medium'|'low', reasons: string[]}}
 */
export function scoreCandidate({ apex, sld, brandHints = [], candidate }) {
    if (!candidate?.reachable) return { confidence: 'low', reasons: ['page-unreachable'] };

    const reasons = [];
    const siteEvidence = String(candidate.evidence || '');
    const simBrand = Math.max(0, ...brandHints.map((b) => nameSimilarity(candidate.pageName, b)));
    const simSld = nameSimilarity(candidate.pageName, sld);
    const bestSim = Math.max(simBrand, simSld);
    const pageMentionsDomain = domainTokenMatch(apex, sld, candidate.pageHtml);

    if (siteEvidence === 'homepage-sameas') {
        reasons.push('site-declares-page(sameAs)');
        if (pageMentionsDomain || bestSim >= 0.6) {
            reasons.push(`page-agrees(sim=${bestSim.toFixed(2)},domain=${pageMentionsDomain})`);
            return { confidence: 'high', reasons };
        }
        // Site declared it but page disagrees/unknown: sameAs on the company's own site is
        // still deliberate human intent — medium unless actively contradicted.
        reasons.push(`no-contradiction(sim=${bestSim.toFixed(2)})`);
        return { confidence: bestSim > 0 ? 'medium' : 'medium', reasons };
    }

    if (WEAK_SITE_EVIDENCE.has(siteEvidence)) {
        reasons.push('site-links-page');
        if (pageMentionsDomain || bestSim >= 0.75) {
            reasons.push(`agreement(strong,sim=${bestSim.toFixed(2)},domain=${pageMentionsDomain})`);
            return { confidence: 'high', reasons };
        }
        reasons.push(`weak-corroboration(sim=${bestSim.toFixed(2)})`);
        return { confidence: bestSim >= 0.4 ? 'medium' : 'low', reasons };
    }

    if (siteEvidence === 'slug-probe' || siteEvidence === 'serp') {
        reasons.push(`discovery(${siteEvidence})`);
        const threshold = siteEvidence === 'serp' ? 0.6 : 0.75;
        if (bestSim >= threshold) {
            reasons.push(`name-match(sim=${bestSim.toFixed(2)}>=${threshold})`);
            return { confidence: siteEvidence === 'serp' && bestSim < 0.75 ? 'medium' : 'medium', reasons };
        }
        if (siteEvidence === 'serp' && pageMentionsDomain) {
            reasons.push('serp+page-domain-reference');
            return { confidence: 'high', reasons };
        }
        reasons.push(`insufficient-name-evidence(sim=${bestSim.toFixed(2)})`);
        return { confidence: 'low', reasons };
    }

    return { confidence: 'low', reasons: ['unknown-evidence-class'] };
}

/**
 * Pick the best candidate from a list of already-scored results.
 * Order of merit: high > medium > low; ties broken by earlier discovery rank.
 */
export function pickBest(scoredList = []) {
    const rank = { high: 3, medium: 2, low: 1 };
    let best = null;
    for (const item of scoredList) {
        if (!best || rank[item.confidence] > rank[best.confidence]) best = item;
    }
    return best;
}
