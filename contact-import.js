/* Contact tables: all processing stays in the browser. */
(function (root) {
    'use strict';
    const MAX_ROWS = 50000;
    const MAX_COLUMNS = 256;
    const cleanHeader = value => String(value ?? '').normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const text = value => String(value ?? '').trim();

    function columns(headers) {
        const result = { full: [], first: [], last: [], org: [], phones: [] };
        headers.forEach((header, index) => {
            const h = cleanHeader(header);
            if (/^(first name|given name|prenom|prenoms)$/.test(h)) result.first.push(index);
            else if (/^(last name|family name|surname|nom de famille)$/.test(h)) result.last.push(index);
            else if (/^(name|full name|display name|formatted name|nom|nom complet|contact|nom du contact)$/.test(h)) result.full.push(index);
            else if (/^(organization|organisation|company|company name|societe|entreprise|organization \d+ name)$/.test(h)) result.org.push(index);
            else if (/^(phone|telephone|tel|mobile|portable|numero|number|numero de telephone|numero telephone|telephone portable|telephone mobile|numero de mobile|numero mobile|tel mobile|tel portable|tel fixe|fixe|telephone fixe|telephone professionnel|telephone personnel|telephone domicile|telephone bureau|telephone principal|autre telephone|telephone autre|telecopie|fax)$/.test(h)
                || /^(phone|telephone) \d+( value)?$/.test(h)
                || /^(home|business|work|mobile|primary|other|company main|assistant s|car|radio) (phone|telephone)( \d+)?$/.test(h)
                || /^(home|business|work|other) fax$/.test(h)) result.phones.push(index);
        });
        // French Outlook exports use separate Prénom and Nom columns.
        if (result.first.length) {
            const surname = result.full.filter(i => cleanHeader(headers[i]) === 'nom');
            result.last.push(...surname);
            result.full = result.full.filter(i => !surname.includes(i));
        }
        return result;
    }

    function hasColumns(mapping) {
        return mapping.full.length + mapping.first.length + mapping.last.length + mapping.phones.length > 0;
    }

    function parseDelimited(input, extension) {
        let source = input.replace(/^\uFEFF/, '');
        const separatorLine = source.match(/^sep=([;,\t|])\r?\n/i);
        let separator = separatorLine?.[1];
        if (separatorLine) source = source.slice(separatorLine[0].length);
        if (!separator) {
            // Count delimiters only outside quoted fields, in the first logical record.
            const counts = { ',': 0, ';': 0, '\t': 0 };
            let quoted = false;
            for (let i = 0; i < source.length; i++) {
                const ch = source[i];
                if (ch === '"') {
                    if (quoted && source[i + 1] === '"') { i++; continue; }
                    quoted = !quoted;
                } else if (!quoted) {
                    if (ch === '\n' || ch === '\r') break;
                    if (ch in counts) counts[ch]++;
                }
            }
            separator = extension === 'tsv' ? '\t' : Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
        }
        const rows = [];
        let row = [], field = '', quoted = false, closedQuote = false;
        function finishField() {
            row.push(field); field = ''; closedQuote = false;
            if (row.length > MAX_COLUMNS) throw new Error('Le fichier dépasse 256 colonnes. Gardez uniquement la feuille de contacts.');
        }
        function finishRow() {
            finishField();
            if (row.some(value => value.trim())) rows.push(row);
            row = [];
            if (rows.length > MAX_ROWS + 1) throw new Error('Le fichier dépasse 50 000 lignes. Divisez votre carnet en plusieurs fichiers.');
        }
        for (let i = 0; i < source.length; i++) {
            const ch = source[i];
            if (quoted) {
                if (ch === '"' && source[i + 1] === '"') { field += '"'; i++; }
                else if (ch === '"') { quoted = false; closedQuote = true; }
                else field += ch;
            } else if (ch === separator) finishField();
            else if (ch === '\r' || ch === '\n') {
                if (ch === '\r' && source[i + 1] === '\n') i++;
                finishRow();
            } else if (ch === '"' && !field.trim() && !closedQuote) {
                field = ''; quoted = true;
            } else if (closedQuote && !/\s/.test(ch)) {
                throw new Error('CSV mal formé : un champ entre guillemets contient une fermeture incorrecte. Réexportez le fichier.');
            } else if (!closedQuote) field += ch;
        }
        if (quoted) throw new Error('CSV incomplet : un champ entre guillemets n’est pas fermé. Réexportez le fichier.');
        if (field || row.length || closedQuote) finishRow();
        return rows;
    }

    function fromRows(rows, label, normalizePhone) {
        const contacts = [], notices = [];
        const headerIndex = rows.findIndex((row, i) => i < 20 && hasColumns(columns(row)));
        if (headerIndex < 0) return null;
        const mapping = columns(rows[headerIndex]);
        const firstValue = (row, indexes) => indexes.map(i => text(row[i])).find(Boolean) || '';
        let invalidPhones = 0;
        for (const row of rows.slice(headerIndex + 1)) {
            const name = firstValue(row, mapping.full)
                || [firstValue(row, mapping.first), firstValue(row, mapping.last)].filter(Boolean).join(' ')
                || firstValue(row, mapping.org);
            const phones = [];
            for (const index of mapping.phones) {
                const cell = text(row[index]);
                if (!cell || /^(aucun numero|none|n a|inconnu)$/.test(cleanHeader(cell))) continue;
                for (const value of cell.split(/\s*(?::::|\||\r?\n)\s*/).filter(Boolean)) {
                    const phone = normalizePhone(value);
                    if (phone) phones.push(phone);
                    else invalidPhones++;
                }
            }
            if (name || phones.length) contacts.push({ name, phones });
        }
        if (!mapping.phones.length) notices.push(`« ${label} » : aucune colonne téléphone reconnue. Les noms sont conservés sans numéro.`);
        if (invalidPhones) notices.push(`« ${label} » : ${invalidPhones} valeur(s) de téléphone non reconnue(s). Vérifiez le fichier source.`);
        return { contacts, notices };
    }

    function fromWorkbook(workbook, xlsx, normalizePhone) {
        const contacts = [], notices = [], skipped = [];
        let totalRows = 0;
        for (const name of workbook.SheetNames) {
            const sheet = workbook.Sheets[name];
            if (!sheet?.['!ref']) continue;
            const range = xlsx.utils.decode_range(sheet['!fullref'] || sheet['!ref']);
            if (range.e.r > MAX_ROWS || range.e.c >= MAX_COLUMNS) {
                throw new Error(`La feuille « ${name} » dépasse 50 000 lignes ou 256 colonnes. Réduisez le fichier avant import.`);
            }
            const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '', blankrows: true });
            totalRows += rows.length;
            if (totalRows > MAX_ROWS + workbook.SheetNames.length) throw new Error('Le classeur dépasse 50 000 lignes. Divisez-le avant import.');
            let numericPhones = false;
            const headerIndex = rows.findIndex((row, i) => i < 20 && hasColumns(columns(row)));
            if (headerIndex >= 0) {
                const phoneColumns = columns(rows[headerIndex]).phones;
                for (let r = headerIndex + 1; r < rows.length; r++) {
                    for (const c of phoneColumns) {
                        const cell = sheet[xlsx.utils.encode_cell({ r: r + range.s.r, c: c + range.s.c })];
                        if (cell?.t === 'n') {
                            numericPhones = true;
                            // General numeric display can use scientific notation; preserve the stored value.
                            if (!cell.z || cell.z === 'General') rows[r][c] = String(cell.v);
                        }
                    }
                }
            }
            const result = fromRows(rows, name, normalizePhone);
            if (result) {
                contacts.push(...result.contacts); notices.push(...result.notices);
                if (numericPhones) notices.push(`« ${name} » : certains téléphones sont des cellules numériques. Vérifiez leurs zéros initiaux ; un zéro déjà perdu dans le fichier ne peut pas être retrouvé automatiquement.`);
            } else skipped.push(name);
        }
        if (!contacts.length) throw new Error('Aucun contact reconnu. La première ligne doit contenir des colonnes comme Nom, Prénom, Téléphone ou Phone 1 - Value.');
        if (skipped.length) notices.push(`Feuilles sans colonnes de contacts ignorées : ${skipped.join(', ')}.`);
        return { contacts, notices };
    }

    root.ContactImport = { columns, parseDelimited, fromRows, fromWorkbook, MAX_ROWS };
    if (typeof module !== 'undefined' && module.exports) module.exports = root.ContactImport;
})(typeof globalThis !== 'undefined' ? globalThis : this);
