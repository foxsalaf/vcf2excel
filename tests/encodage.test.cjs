'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./load-app.cjs');

const toArrayBuffer = buffer => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
const decode = buffer => loadApp().call('decoderFichierVcf', toArrayBuffer(buffer));

test('UTF-8 files are decoded as UTF-8', () => {
  const result = decode(Buffer.from('FN:Élodie\r\n', 'utf8'));
  assert.equal(result.encoding, 'utf-8');
  assert.equal(result.text, 'FN:Élodie\r\n');
});
test('a UTF-8 byte order mark does not break decoding', () => {
  const result = decode(Buffer.concat([Buffer.from([0xEF, 0xBB, 0xBF]), Buffer.from('FN:Élodie', 'utf8')]));
  assert.equal(result.encoding, 'utf-8');
  assert.equal(result.text.replace(/^﻿/, ''), 'FN:Élodie');
});
test('Windows-1252 files fall back to Windows-1252', () => {
  const result = decode(Buffer.from('FN:Élodie\r\n', 'latin1'));
  assert.equal(result.encoding, 'windows-1252');
  assert.equal(result.text, 'FN:Élodie\r\n');
});
test('UTF-16 files with a byte order mark are decoded', () => {
  const le = Buffer.concat([Buffer.from([0xFF, 0xFE]), Buffer.from('FN:Élodie', 'utf16le')]);
  const result = decode(le);
  assert.equal(result.encoding, 'utf-16le');
  assert.equal(result.text, 'FN:Élodie');
});
test('a Windows-1252 export is converted end to end', () => {
  const app = loadApp();
  const bytes = Buffer.from('BEGIN:VCARD\r\nVERSION:2.1\r\nN:Dupont;Élodie;;;\r\nTEL;CELL:0612345678\r\nEND:VCARD\r\n', 'latin1');
  const { text } = app.call('decoderFichierVcf', toArrayBuffer(bytes));
  assert.deepEqual(app.run(text).rows, [{ nom: 'Élodie Dupont', numero: '06 12 34 56 78', type: 'Mobile' }]);
});
