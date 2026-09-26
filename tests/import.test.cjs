'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const XLSX = require('../vendor/xlsx.full.min.js');
const ContactImport = require('../contact-import.js');
const { loadApp, card } = require('./load-app.cjs');

function importText(content, filename = 'contacts.csv') {
    return JSON.parse(JSON.stringify(loadApp().call('importerContacts', new TextEncoder().encode(content), filename)));
}
function book(sheets, type = 'xlsx') {
    const workbook = XLSX.utils.book_new();
    for (const [name, rows] of Object.entries(sheets)) XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), name);
    return XLSX.write(workbook, { type: 'buffer', bookType: type });
}
const importBook = (bytes, filename) => JSON.parse(JSON.stringify(loadApp().call('importerContacts', bytes, filename)));

test('French semicolon CSV combines first/last names, sorts and deduplicates canonical phones', () => {
    const result = importText('Prénom;Nom;Téléphone\r\nZoé;Exemple;0639123456\r\nAlice;Test;+33612345678\r\nAlice;Test;0612345678');
    assert.deepEqual(result.rows, [
        { nom: 'Alice Test', numero: '06 12 34 56 78', type: 'Mobile' },
        { nom: 'Zoé Exemple', numero: '06 39 12 34 56', type: 'Mobile' }
    ]);
});
test('Google CSV ignores phone type labels and imports all value columns', () => {
    const result = importText('Name,Phone 1 - Type,Phone 1 - Value,Phone 2 - Type,Phone 2 - Value\nAlice,Mobile,0612345678,Home,0123456789');
    assert.equal(result.rows.length, 2);
    assert.equal(result.rows[0].nom, 'Alice I');
    assert.equal(result.rows[0].numero, '01 23 45 67 89');
});
test('Google multi-value phone cells retain both numbers', () => {
    assert.equal(importText('Name,Phone 1 - Value\nAlice,0612345678 ::: 0712345678').rows.length, 2);
});
test('Outlook English CSV combines names and extracts mobile/business phones', () => {
    const result = importText('First Name,Last Name,Mobile Phone,Business Phone,E-mail Address\nAlice,Test,0612345678,0123456789,example@example.invalid');
    assert.equal(result.rows.length, 2);
    assert.equal(result.rows[0].nom, 'Alice Test I');
});
test('quoted commas, escaped quotes and embedded newlines are retained', () => {
    const rows = ContactImport.parseDelimited('Name,Phone,Notes\r\n"Test, ""Alice""",0612345678,"line 1\nline 2"', 'csv');
    assert.deepEqual(rows[1], ['Test, "Alice"', '0612345678', 'line 1\nline 2']);
});
test('TSV and Excel separator directives preserve zeros', () => {
    assert.equal(importText('Nom\tTéléphone\nAlice\t0612345678', 'contacts.tsv').rows[0].numero, '06 12 34 56 78');
    assert.equal(importText('sep=;\r\nNom;Téléphone\r\nAlice;0612345678').rows[0].numero, '06 12 34 56 78');
});
test('UTF-8 BOM and Windows-1252 CSV are supported', () => {
    assert.equal(importText('\ufeffNom;Téléphone\nÉlodie;0612345678').rows[0].nom, 'Élodie');
    const bytes = Buffer.from('Nom;Telephone\nÉlodie;0612345678', 'latin1');
    const result = importBook(bytes, 'contacts.csv');
    assert.equal(result.rows[0].nom, 'Élodie');
    assert.equal(result.encoding, 'windows-1252');
});
test('malformed CSV and unknown headers produce actionable errors', () => {
    assert.throws(() => importText('Name,Phone\n"Alice,0612345678'), /fermé/);
    assert.throws(() => importText('Name,Phone\n"Alice"oops,0612345678'), /mal formé/);
    assert.throws(() => importText('Product,Amount\nPaper,10'), /Colonnes non reconnues/);
});
test('contacts with names and no telephone are preserved', () => {
    assert.deepEqual(importText('Nom;Téléphone\nAlice;\n;\nBob;0612345678').rows.map(r => r.nom), ['Alice', 'Bob']);
    assert.equal(importText('Nom\nAlice').rows[0].numero, 'Aucun numéro');
});
test('a shared number under two names is not deleted', () => {
    const result = importText('Nom,Telephone\nZoé,0612345678\nAlice,+33612345678');
    assert.equal(result.rows.length, 2);
});
test('VCF imports also return alphabetically ordered rows', () => {
    const result = importText(card('FN:Zoé', 'TEL:0639123456') + '\n' + card('FN:Alice', 'TEL:0612345678'), 'contacts.vcf');
    assert.deepEqual(result.rows.map(r => r.nom), ['Alice', 'Zoé']);
});
for (const type of ['xlsx', 'xls', 'ods']) {
    test(`${type.toUpperCase()} reads real workbook bytes and preserves phone text`, () => {
        const bytes = book({ Contacts: [['Nom', 'Téléphone'], ['Zoé', '0639123456'], ['Alice', '0612345678']] }, type);
        const result = importBook(bytes, `contacts.${type}`);
        assert.deepEqual(result.rows.map(r => r.nom), ['Alice', 'Zoé']);
        assert.equal(result.rows[0].numero, '06 12 34 56 78');
    });
}
test('all contact sheets are combined and non-contact sheets are skipped', () => {
    const bytes = book({ Notes: [['Read me'], ['Instructions']], A: [['Name', 'Phone'], ['Zoé', '0639123456']], B: [['Name', 'Phone'], ['Alice', '0612345678']] });
    assert.deepEqual(importBook(bytes, 'contacts.xlsx').rows.map(r => r.nom), ['Alice', 'Zoé']);
});
test('Excel display formats preserve intentional leading zeros', () => {
    const sheet = XLSX.utils.aoa_to_sheet([['Nom', 'Téléphone'], ['Alice', 612345678]]);
    sheet.B2.z = '0000000000';
    const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, sheet, 'Contacts');
    const bytes = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    assert.equal(importBook(bytes, 'contacts.xlsx').rows[0].numero, '06 12 34 56 78');
});
test('numeric phones preserve stored digits without inventing a missing zero', () => {
    const result = importBook(book({ Contacts: [['Nom', 'Téléphone'], ['Alice', 612345678]] }), 'contacts.xlsx');
    assert.equal(result.rows[0].numero, '612345678');
});
test('oversized tables fail explicitly rather than silently truncate', () => {
    assert.throws(() => ContactImport.parseDelimited('Nom,Phone\n' + 'Alice,0612345678\n'.repeat(50001), 'csv'), /50 000/);
});

test('offset worksheet ranges retain numeric phone warnings and formatting', () => {
    const sheet = { D5: {t:'s',v:'Nom'}, E5: {t:'s',v:'Phone'}, D6: {t:'s',v:'Alice'}, E6: {t:'n',v:33612345678,z:'General'}, '!ref':'D5:E6' };
    const result = ContactImport.fromWorkbook({SheetNames:['Contacts'],Sheets:{Contacts:sheet}}, XLSX, value => value);
    assert.equal(result.contacts[0].phones[0], '33612345678');
    assert.match(result.notices.join(' '), /cellules numériques/);
});

test('repeated names receive Roman suffixes after exact phone deduplication', () => {
    const result = importText('Nom,Telephone\nAlice,0712345678\nAlice,0612345678\nAlice,+33612345678\nAlice,0123456789\nAlice,0512345678\nBob,0612345678');
    assert.deepEqual(result.rows.map(r => r.nom), ['Alice I', 'Alice II', 'Alice III', 'Alice IV', 'Bob']);
    assert.deepEqual(result.rows.slice(0, 4).map(r => r.numero), ['01 23 45 67 89', '05 12 34 56 78', '06 12 34 56 78', '07 12 34 56 78']);
});

test('Roman numbering also applies to VCF and does not repeat when importing an export', () => {
    const result = importText(card('FN:Alice', 'TEL:0612345678', 'TEL:0712345678'), 'contacts.vcf');
    assert.deepEqual(result.rows.map(r => r.nom), ['Alice I', 'Alice II']);
    const bytes = book({ Contacts: [['Nom', 'Numéro'], ...result.rows.map(r => [r.nom, r.numero])] });
    assert.deepEqual(importBook(bytes, 'contacts.xlsx').rows, result.rows);
});

test('unnamed contacts and names without a phone are not numbered', () => {
    const result = importText('Nom,Telephone\n,0612345678\n,0712345678\nAlice,\nAlice,0612345678');
    assert.deepEqual(result.rows.map(r => r.nom), ['Alice', 'Alice', 'Sans nom', 'Sans nom']);
});

test('Roman suffixes use IV, IX and X correctly', () => {
    const app = loadApp();
    assert.deepEqual([1,2,3,4,9,10,14].map(n => app.call('chiffresRomains', n)), ['I','II','III','IV','IX','X','XIV']);
});
