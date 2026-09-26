(function (root) {
    'use strict';
    const key = name => name.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
    function close(a, b) {
        if (a === b) return true;
        if (Math.abs(a.length - b.length) > 1) return false;
        let i = 0, j = 0, edits = 0;
        while (i < a.length && j < b.length) {
            if (a[i] === b[j]) { i++; j++; continue; }
            if (++edits > 1) return false;
            if (a.length >= b.length) i++;
            if (b.length >= a.length) j++;
        }
        return edits + (i < a.length || j < b.length ? 1 : 0) <= 1;
    }
    const pairKey = (a, b) => JSON.stringify([a, b].sort());
    function suggest(rows, ignored = new Set()) {
        const names = [...new Set(rows.map(row => row.nom))];
        const buckets = new Map(), seen = new Set(), pairs = [];
        let comparisons = 0, limited = false;
        for (const name of names) {
            const normalized = key(name);
            if (name === 'Sans nom' || normalized.length < 5) continue;
            if (normalized.length > 100) { limited = true; continue; }
            const signatures = new Set([normalized]);
            for (let i = 0; i < normalized.length; i++) signatures.add(normalized.slice(0, i) + normalized.slice(i + 1));
            for (const signature of signatures) {
                const bucket = buckets.get(signature) || [];
                for (const other of bucket) {
                    const id = pairKey(name, other.name);
                    if (seen.has(id) || ignored.has(id)) continue;
                    seen.add(id);
                    if (++comparisons > 50000) return { pairs, limited: true };
                    if (close(normalized, other.normalized)) {
                        pairs.push([other.name, name]);
                        if (pairs.length >= 100) return { pairs, limited: true };
                    }
                }
                if (bucket.length < 30) bucket.push({ name, normalized });
                else limited = true;
                buckets.set(signature, bucket);
            }
        }
        return { pairs, limited };
    }
    function merge(rows, from, into) {
        if (from === into || !rows.some(r => r.nom === from) || !rows.some(r => r.nom === into)) return rows.map(r => ({...r}));
        const seen = new Set();
        return rows.map(row => ({ ...row, nom: row.nom === from ? into : row.nom })).filter(row => {
            if (row.numero === 'Aucun numéro') return true;
            const id = JSON.stringify([row.nom, row.numero]);
            if (seen.has(id)) return false;
            seen.add(id); return true;
        });
    }
    root.ContactReview = { suggest, merge, pairKey };
    if (typeof module !== 'undefined' && module.exports) module.exports = root.ContactReview;
})(typeof globalThis !== 'undefined' ? globalThis : this);
