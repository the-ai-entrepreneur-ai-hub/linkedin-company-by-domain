/**
 * R4 — Wikidata brand oracle. Free, keyless SPARQL: find the organization whose official
 * website (P856) is this domain, and take its label as an authoritative brand hint.
 *
 * This rung does NOT produce LinkedIn URLs. It upgrades every other rung: the label feeds
 * slug candidates (R2) and the SERP query (R3), and gives the scorer a name-truth to match
 * page titles against — which is exactly how wrong-company rows get caught before billing.
 */

const ENDPOINT = 'https://query.wikidata.org/sparql';
const UA = 'linkedin-company-by-domain/0.1 (Apify Actor; contact: george.the.developer)';

export function buildSparqlQuery(apex) {
    const site = String(apex).toLowerCase();
    return `SELECT ?org ?orgLabel WHERE {
  ?org wdt:P856 ?site .
  FILTER(STR(?site) = "https://${site}" || STR(?site) = "http://${site}" || STR(?site) = "https://www.${site}" || STR(?site) = "http://www.${site}")
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} LIMIT 3`;
}

export function parseSparqlResponse(json) {
    const bindings = json?.results?.bindings;
    if (!Array.isArray(bindings)) return [];
    const labels = [];
    for (const b of bindings) {
        const label = b?.orgLabel?.value;
        if (typeof label === 'string' && label.trim()) labels.push(label.trim());
    }
    return [...new Set(labels)];
}

export async function wikidataBrandRung({ apex, timeoutMs = 8000 }) {
    try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), timeoutMs);
        const url = `${ENDPOINT}?query=${encodeURIComponent(buildSparqlQuery(apex))}&format=json`;
        const res = await fetch(url, {
            headers: { 'User-Agent': UA, 'Accept': 'application/sparql-results+json' },
            signal: ctrl.signal,
        }).finally(() => clearTimeout(timer));
        if (!res.ok) return { ok: false, brands: [] };
        const json = await res.json().catch(() => null);
        return { ok: true, brands: parseSparqlResponse(json) };
    } catch {
        return { ok: false, brands: [] };
    }
}
