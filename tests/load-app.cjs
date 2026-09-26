'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Charge le script réel de index.html dans un contexte sans DOM ni dépendance externe.
// Le script du CDN (SheetJS) est ignoré ; les éléments de page sont remplacés par des coquilles.
function loadApp() {
  const root = process.env.VCF_APP_ROOT || path.join(__dirname, '..');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const element = () => ({
    addEventListener() {},
    setAttribute() {},
    appendChild() {},
    style: {},
    dataset: {},
    classList: { add() {}, remove() {} },
    textContent: '',
    innerHTML: '',
    hidden: false,
    disabled: false,
    value: ''
  });
  const context = vm.createContext({
    console,
    TextDecoder,
    TextEncoder,
    document: { getElementById: element, querySelectorAll: () => [], createElement: element }
  });
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const src = match[1].match(/src=["']([^"']+)["']/i);
    if (src && /^https?:/.test(src[1])) continue;
    const code = src ? fs.readFileSync(path.join(root, src[1]), 'utf8') : match[2];
    vm.runInContext(code, context);
  }
  return {
    // Convertit un texte VCF et renvoie lignes, statistiques et avertissements.
    run(content) {
      context.input = content;
      return JSON.parse(vm.runInContext(
        'stats = creerStats(); warnings = []; duplicateNumbers.clear();' +
        'JSON.stringify({ rows: processVCFFile(input), stats, warnings })', context));
    },
    // Appelle une fonction pure du script avec des arguments.
    call(name, ...args) {
      context.args = args;
      return vm.runInContext(`${name}(...args)`, context);
    }
  };
}

const card = (...lines) => ['BEGIN:VCARD', 'VERSION:3.0', ...lines, 'END:VCARD'].join('\r\n');

module.exports = { loadApp, card };
