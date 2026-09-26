# vcf2excel

Récupère et organise les contacts d'un fichier VCF, CSV, TSV, Excel (.xlsx/.xls) ou ODS en classeur Excel (.xlsx), directement dans le navigateur.

**Utiliser l'outil : https://foxsalaf.github.io/vcf2excel/**

[![Tests](https://github.com/foxsalaf/vcf2excel/actions/workflows/tests.yml/badge.svg)](https://github.com/foxsalaf/vcf2excel/actions/workflows/tests.yml)

![Page d'accueil de VCF to Excel](docs/capture.jpg)

## Ce que fait l'outil

- Reconnaît les colonnes courantes françaises, Google Contacts et Outlook : noms, prénoms et plusieurs téléphones. Les feuilles de contacts d'un classeur sont réunies.
- Trie les contacts par nom puis par numéro.
- Lit les vCard 2.1, 3.0 et 4.0 : lignes pliées, encodage quoted-printable, caractères échappés, fichiers UTF-8, UTF-16 ou Windows-1252.
- Nom du contact : `FN`, sinon `N` (prénom nom), sinon `ORG` ; « Sans nom » à défaut.
- Numéros mis en forme par paires (`06 12 34 56 78`) pour la France métropolitaine et les départements d'outre-mer (+33, +262, +590, +594, +596) ; les autres pays restent en forme internationale (`+4915123456789`).
- Colonne **Type** : Mobile, Fixe, International ou Inconnu.
- Doublons : une ligne identique (même nom, même numéro) n'est gardée qu'une fois ; un numéro présent sous plusieurs noms est conservé et signalé dans le bilan.
- Deux exports : tous les contacts, ou seulement ceux qui ont un numéro.
- Rien n'est envoyé sur un serveur : le fichier est lu et converti dans le navigateur.

## Fichier produit

Une feuille « Contacts », trois colonnes, un numéro par ligne.

| Nom | Numéro | Type |
| --- | --- | --- |
| Alice Exemple | 06 12 34 56 78 | Mobile |
| Alice Exemple | 01 23 45 67 89 | Fixe |
| Société Fictive | +4915123456789 | International |
| Contact Sans Numéro | Aucun numéro | |

## Utilisation

1. Ouvrez la page et déposez votre fichier `.vcf`, `.vcard`, `.csv`, `.tsv`, `.xlsx`, `.xls` ou `.ods`, ou choisissez-le sur votre appareil.
2. Cliquez sur « Convertir en Excel » : le bilan affiche les contacts lus, les numéros extraits et les points à vérifier.
3. Téléchargez « Tous les contacts » ou « Avec téléphone uniquement ».

Le fichier `.vcf` s'obtient par l'export de votre carnet d'adresses (téléphone, Google Contacts, iCloud, Outlook).

Pour un tableau, utilisez une ligne d'en-tête comme `Prénom;Nom;Téléphone` ou `Name,Phone 1 - Value`. Les séparateurs virgule, point-virgule et tabulation sont reconnus. Conservez les téléphones en texte pour préserver leurs zéros initiaux. Les colonnes non reconnues ne sont pas devinées.

## Limites

- Seuls le nom et les numéros sont exportés, pas les adresses e-mail ni postales.
- Les numéros hors France sont conservés tels quels, sans mise en forme.
- Fichier limité à 10 Mo ; tableaux limités à 50 000 lignes et 256 colonnes. Les classeurs protégés par mot de passe ne sont pas pris en charge.
- Un zéro initial déjà perdu dans une cellule numérique ne peut pas être reconstruit. Un avertissement invite à vérifier ces cellules.
- Les PDF, images et formats propriétaires ne sont pas pris en charge.
- SheetJS 0.20.3 est fourni localement dans `vendor/`, avec sa licence ; aucun CDN tiers n'est nécessaire.

## Développement

Le site est une page statique (`index.html`, `styles.css`), publiée par GitHub Pages depuis la branche `main`. Aucune étape de construction.

```
node --test
```

Les tests (Node 22, sans dépendance) chargent le script réel de `index.html` et vérifient l'analyse des vCard, la normalisation des numéros, les encodages et la conversion du fichier d'exemple `tests/fixtures/exemple.vcf`. Ils s'exécutent aussi dans GitHub Actions à chaque modification.

## Licence

MIT. Développé par Mouhammad, avec l'aide de Claude et de Codex.
