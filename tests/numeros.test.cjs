'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, card } = require('./load-app.cjs');

const app = () => loadApp();

test('normaliserNumero brings French numbers to ten national digits', () => {
  const a = app();
  assert.equal(a.call('normaliserNumero', '+33 6 12 34 56 78'), '0612345678');
  assert.equal(a.call('normaliserNumero', '0033612345678'), '0612345678');
  assert.equal(a.call('normaliserNumero', '+33 (0)6 12 34 56 78'), '0612345678');
  assert.equal(a.call('normaliserNumero', 'tel:+33-1-23-45-67-89'), '0123456789');
  assert.equal(a.call('normaliserNumero', '06.12.34.56.78'), '0612345678');
});
test('normaliserNumero keeps other countries in international form', () => {
  const a = app();
  assert.equal(a.call('normaliserNumero', '+49 151 2345 6789'), '+4915123456789');
  assert.equal(a.call('normaliserNumero', '00 44 20 7946 0958'), '+442079460958');
});
test('normaliserNumero drops extensions and pauses but keeps the base number', () => {
  const a = app();
  assert.equal(a.call('normaliserNumero', '0612345678,123'), '0612345678');
  assert.equal(a.call('normaliserNumero', '+33612345678;ext=12'), '0612345678');
  assert.equal(a.call('normaliserNumero', '01 23 45 67 89 x 45'), '0123456789');
});
test('normaliserNumero rejects values that are not numbers', () => {
  const a = app();
  assert.equal(a.call('normaliserNumero', ''), null);
  assert.equal(a.call('normaliserNumero', 'abc'), null);
  assert.equal(a.call('normaliserNumero', '12'), null);
});
test('Mayotte and other overseas departments are French numbers', () => {
  const rows = app().run(card('FN:Amina', 'TEL:+262 639 12 34 56', 'TEL:+262269601234',
    'TEL:+590 690 12 34 56', 'TEL:+594594123456', 'TEL:+596 696 12 34 56', 'TEL:+262 262 12 34 56')).rows;
  assert.deepEqual(rows.map(r => [r.numero, r.type]), [
    ['06 39 12 34 56', 'Mobile'],
    ['02 69 60 12 34', 'Fixe'],
    ['06 90 12 34 56', 'Mobile'],
    ['05 94 12 34 56', 'Fixe'],
    ['06 96 12 34 56', 'Mobile'],
    ['02 62 12 34 56', 'Fixe']
  ]);
});
test('type detection: mobile, landline, international, unknown', () => {
  const a = app();
  assert.equal(a.call('detecterTypeNumero', '07 12 34 56 78'), 'Mobile');
  assert.equal(a.call('detecterTypeNumero', '+33 9 70 12 34 56'), 'Fixe');
  assert.equal(a.call('detecterTypeNumero', '+4915123456789'), 'International');
  assert.equal(a.call('detecterTypeNumero', '0800123456'), 'Inconnu');
  assert.equal(a.call('detecterTypeNumero', '06123456789'), 'Inconnu');
  assert.equal(a.call('detecterTypeNumero', '3631'), 'Inconnu');
});
test('formatting groups French numbers by two digits', () => {
  const a = app();
  assert.equal(a.call('formaterNumeroFrancais', '+33612345678'), '06 12 34 56 78');
  assert.equal(a.call('formaterNumeroFrancais', '+4915123456789'), '+4915123456789');
  assert.equal(a.call('formaterNumeroFrancais', 'n/a'), 'n/a');
});
test('the same number written differently inside one contact gives one row', () => {
  const result = app().run(card('FN:Alice', 'TEL;TYPE=CELL:06 12 34 56 78', 'TEL;TYPE=VOICE:+33612345678'));
  assert.equal(result.rows.length, 1);
  assert.equal(result.stats.totalPhoneNumbers, 1);
});
test('identical name and number across contacts are kept once and counted', () => {
  const result = app().run([
    card('FN:Alice', 'TEL:0612345678'),
    card('FN:Alice', 'TEL:+33 6 12 34 56 78')
  ].join('\r\n'));
  assert.equal(result.rows.length, 1);
  assert.equal(result.stats.duplicatesRemoved, 1);
  assert.equal(result.stats.duplicatesDetected, 0);
  assert.deepEqual(result.warnings, []);
});
test('one number under two names is kept twice and reported', () => {
  const result = app().run([
    card('FN:Alice', 'TEL:0612345678'),
    card('FN:Bob', 'TEL:+33612345678')
  ].join('\r\n'));
  assert.equal(result.rows.length, 2);
  assert.equal(result.stats.duplicatesDetected, 1);
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0], /06 12 34 56 78/);
  assert.match(result.warnings[0], /Alice, Bob/);
});
test('statistics count contacts, phones and rows', () => {
  const result = app().run([
    card('FN:Alice', 'TEL:0612345678', 'TEL:0123456789'),
    card('FN:Bob'),
    card('N:;;;;')
  ].join('\r\n'));
  assert.deepEqual(result.stats, {
    totalContacts: 3,
    contactsWithPhone: 1,
    contactsWithoutPhone: 2,
    totalPhoneNumbers: 2,
    contactsAddedToExcel: 4,
    duplicatesDetected: 0,
    duplicatesRemoved: 0
  });
  assert.equal(result.rows[3].nom, 'Sans nom');
});
