'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadApp } = require('./load-app.cjs');

// Le fichier d'exemple mélange vCard 2.1, 3.0 et 4.0 avec des contacts fictifs.
test('the sample file converts as documented', () => {
  const content = fs.readFileSync(path.join(__dirname, 'fixtures', 'exemple.vcf'), 'utf8');
  const result = loadApp().run(content);
  assert.deepEqual(result.rows, [
    { nom: 'Alice Exemple', numero: '06 12 34 56 78', type: 'Mobile' },
    { nom: 'Alice Exemple', numero: '01 23 45 67 89', type: 'Fixe' },
    { nom: 'Élodie Test', numero: '06 39 12 34 56', type: 'Mobile' },
    { nom: 'Élodie Test', numero: '02 69 60 12 34', type: 'Fixe' },
    { nom: 'Bob Test', numero: '06 12 34 56 78', type: 'Mobile' },
    { nom: 'Société Fictive', numero: '+4915123456789', type: 'International' },
    { nom: 'Contact Sans Numéro', numero: 'Aucun numéro', type: '' },
    { nom: 'Nom Très Long Sur Deux Lignes', numero: '09 70 12 34 56', type: 'Fixe' }
  ]);
  assert.deepEqual(result.stats, {
    totalContacts: 7,
    contactsWithPhone: 6,
    contactsWithoutPhone: 1,
    totalPhoneNumbers: 8,
    contactsAddedToExcel: 8,
    duplicatesDetected: 1,
    duplicatesRemoved: 1
  });
  assert.deepEqual(result.warnings, ['Le numéro 06 12 34 56 78 apparaît sous plusieurs noms : Alice Exemple, Bob Test.']);
});
