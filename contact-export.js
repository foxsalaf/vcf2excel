(function (root) {
    'use strict';
    function googleCSV(rows) {
        const quote = value => '"' + String(value ?? '').replace(/"/g, '""') + '"';
        const lines = [['First Name', 'Phone 1 - Label', 'Phone 1 - Value']];
        for (const row of rows) {
            const phone = row.numero === 'Aucun numéro' ? '' : row.numero;
            // Preserve the complete display name, including Roman suffixes, without guessing its parts.
            lines.push([row.nom, phone && row.type === 'Mobile' ? 'Mobile' : '', phone]);
        }
        return '\uFEFF' + lines.map(line => line.map(quote).join(',')).join('\r\n') + '\r\n';
    }
    function googleParts(rows) {
        const parts = [];
        for (let offset = 0; offset < rows.length; offset += 3000) parts.push(googleCSV(rows.slice(offset, offset + 3000)));
        return parts;
    }
    root.ContactExport = { googleCSV, googleParts };
    if (typeof module !== 'undefined' && module.exports) module.exports = root.ContactExport;
})(typeof globalThis !== 'undefined' ? globalThis : this);
