'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const Review = require('../contact-review.js');
const {loadApp} = require('./load-app.cjs');
const row = (nom, numero = '06 00 00 00 01') => ({nom, numero, type:'Mobile'});

test('one-letter differences with case variants produce suggestions without changing input', () => {
    const rows = [row('Marina soeur'), row('Marita Soeur', '06 00 00 00 02')];
    const snapshot = JSON.stringify(rows);
    assert.deepEqual(Review.suggest(rows).pairs, [['Marina soeur','Marita Soeur']]);
    assert.equal(JSON.stringify(rows), snapshot);
});
test('insertions, deletions, accent and case differences are proposed', () => {
    for (const pair of [['Elodie','ÉLODIE'],['Marina soeur','Mariina soeur'],['Marina soeur','Marin soeur']]) {
        assert.equal(Review.suggest(pair.map(n => row(n))).pairs.length, 1);
    }
});
test('different names, exact duplicates and unnamed entries are not proposed', () => {
    assert.deepEqual(Review.suggest([row('Alice'),row('Robert'),row('Alice'),row('Sans nom'),row('Sans nom')]).pairs, []);
});
test('an ignored pair stays ignored regardless of input order', () => {
    const ignored = new Set([Review.pairKey('Marina','Marita')]);
    assert.deepEqual(Review.suggest([row('Marita'),row('Marina')], ignored).pairs, []);
});
test('confirmed merge preserves distinct phones and removes exact overlap', () => {
    const input = [row('Marina'),row('Marita'),row('Marita','06 00 00 00 02'),row('Alice')];
    const merged = Review.merge(input,'Marita','Marina');
    assert.deepEqual(merged.map(r => r.nom), ['Marina','Marina','Alice']);
    const sorted = loadApp().call('trierContacts', merged);
    assert.deepEqual(Array.from(sorted, r => r.nom), ['Alice','Marina I','Marina II']);
    assert.equal(input[1].nom, 'Marita');
});
test('candidate result count is bounded on large ambiguous name sets', () => {
    const rows = Array.from({length:150}, (_,i) => row('Personne ' + i));
    const result = Review.suggest(rows);
    assert.ok(result.pairs.length <= 100);
    assert.equal(result.limited, true);
});
