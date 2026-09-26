const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Exercise the actual browser script, without a DOM or external packages.
function parser() {
  const root = process.env.VCF_APP_ROOT || path.join(__dirname, '..');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const element = () => ({ addEventListener() {}, style: {}, classList: { add() {}, remove() {} } });
  const context = vm.createContext({ console, TextDecoder, TextEncoder,
    document: { getElementById: element, querySelectorAll: () => [] } });
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const src = match[1].match(/src=["']([^"']+)["']/i);
    if (src && /^https?:/.test(src[1])) continue;
    const code = src ? fs.readFileSync(path.join(root, src[1]), 'utf8') : match[2];
    vm.runInContext(code, context);
  }
  return content => {
    context.input = content;
    return JSON.parse(vm.runInContext('JSON.stringify(processVCFFile(input))', context));
  };
}
const card = (...lines) => ['BEGIN:VCARD', 'VERSION:3.0', ...lines, 'END:VCARD'].join('\r\n');

test('ordinary contact and grouped telephone', () => {
  const rows = parser()(card('FN:Alice', 'item1.TEL;TYPE=CELL:06 12 34 56 78'));
  assert.deepEqual(rows, [{ nom: 'Alice', numero: '06 12 34 56 78', type: 'Mobile' }]);
});
test('contacts without phone are preserved', () => {
  assert.equal(parser()(card('FN:Alice'))[0].nom, 'Alice');
});
test('parameterized formatted name preserves accents', () => {
  assert.equal(parser()(card('FN;CHARSET=UTF-8:Élodie'))[0].nom, 'Élodie');
});
test('structured name is used when FN is absent', () => {
  assert.equal(parser()(card('N:Dupont;Alice;;;'))[0].nom, 'Alice Dupont');
});
test('folded names are unfolded', () => {
  assert.equal(parser()(card('FN:Alice très', ' longue'))[0].nom, 'Alice trèslongue');
});
test('escaped text values are decoded', () => {
  assert.equal(parser()(card('FN:Dupont\\, Alice'))[0].nom, 'Dupont, Alice');
});
test('vCard 4 telephone URI is retained', () => {
  const rows = parser()(card('FN:Alice', 'TEL;VALUE=uri:tel:+33612345678'));
  assert.equal(rows[0].numero.replace(/\s/g, '').replace(/^0/, '+33'), '+33612345678');
});
test('TEL inside a NOTE is not interpreted as a phone property', () => {
  const rows = parser()(card('FN:Alice', 'NOTE:HOTEL:0123456789'));
  assert.equal(rows[0].numero, 'Aucun numéro');
});
test('classic Mac CR line endings preserve contacts', () => {
  assert.equal(parser()(card('FN:Alice', 'TEL:0612345678').replace(/\r\n/g, '\r')).length, 1);
});
test('quoted printable names are decoded', () => {
  assert.equal(parser()(card('FN;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:=C3=89lodie'))[0].nom, 'Élodie');
});
