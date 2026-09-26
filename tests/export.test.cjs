'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const Export = require('../contact-export.js');
const Import = require('../contact-import.js');
const {loadApp} = require('./load-app.cjs');

test('Google CSV retains accents, quoted names, leading zero and international plus', () => {
    const rows = [{nom:'Élodie, "Amie" I',numero:'06 00 00 00 01',type:'Mobile'}, {nom:'Élodie, "Amie" II',numero:'+491234567890',type:'International'}];
    const csv = Export.googleCSV(rows);
    const table = Import.parseDelimited(csv,'csv');
    assert.deepEqual(table[0], ['First Name','Phone 1 - Label','Phone 1 - Value']);
    assert.deepEqual(table[1], ['Élodie, "Amie" I','Mobile','06 00 00 00 01']);
    assert.equal(table[2][2], '+491234567890');
    const result = loadApp().call('importerContacts', new TextEncoder().encode(csv), 'google.csv');
    assert.deepEqual(JSON.parse(JSON.stringify(result.rows)), rows);
});
test('missing numbers produce blank Google fields rather than placeholder text', () => {
    const table = Import.parseDelimited(Export.googleCSV([{nom:'Alice',numero:'Aucun numéro',type:''}]),'csv');
    assert.deepEqual(table[1], ['Alice','','']);
});
test('Google batches keep each contact once, with a header in every file', () => {
    const rows = Array.from({length:3001},(_,i)=>({nom:'Contact '+i,numero:'0600000001',type:'Mobile'}));
    const parts = Export.googleParts(rows);
    assert.equal(parts.length, 2);
    assert.equal(Import.parseDelimited(parts[0],'csv').length, 3001);
    assert.equal(Import.parseDelimited(parts[1],'csv').length, 2);
    assert.equal(Import.parseDelimited(parts[1],'csv')[1][0], 'Contact 3000');
});
