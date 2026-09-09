# Shared Spreadsheet Database

This project uses Google Drive spreadsheets as a shared database layer. The same pattern can be used from any Google Apps Script project, as long as the project has the required script property configured.

## Mental Model

- A logical table is a Google Spreadsheet file.
- A sheet is a tab inside that spreadsheet.
- A central registry spreadsheet maps logical table names to spreadsheet IDs.
- Any Apps Script project can access the registered spreadsheets through the registry.

Every Apps Script project that needs this shared database must define the script property:

```text
db
```

The value of `db` is the spreadsheet ID of the central registry spreadsheet.

The registry spreadsheet must contain a sheet named `tables`.

Registry schema:

| Column | Meaning |
| --- | --- |
| A | Logical table name |
| B | Spreadsheet ID |

When a request uses the form:

```text
Logical table -> sheet
```

read it as:

1. Read the current Apps Script project's `db` script property.
2. Open that registry spreadsheet.
3. Open its `tables` sheet.
4. Find the row where column A matches the logical table name.
5. Read column B from that row.
6. Open that spreadsheet ID.
7. Open the requested sheet/tab inside that spreadsheet.

For example:

```text
Dinantia -> teachers_2_dinantia
```

means: resolve logical table `Dinantia` through the registry, then open its `teachers_2_dinantia` tab.

It does not mean:

- A spreadsheet literally named `teachers_2_dinantia`
- A Drive search for `teachers_2_dinantia`
- A script property called `teachers_2_dinantia`
- A hardcoded spreadsheet ID

## Apps Script Helpers

```javascript
function openLogicalTableSpreadsheet_(logicalTableName) {
  const dbId = PropertiesService.getScriptProperties().getProperty('db');
  if (!dbId) throw new Error('Missing script property "db".');

  const registry = SpreadsheetApp.openById(dbId);
  const tables = registry.getSheetByName('tables');
  if (!tables) throw new Error('Database registry sheet "tables" not found.');

  const values = tables.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    const name = String(values[i][0] || '').trim();
    const spreadsheetId = String(values[i][1] || '').trim();

    if (name === logicalTableName && spreadsheetId) {
      return SpreadsheetApp.openById(spreadsheetId);
    }
  }

  throw new Error('Logical table not found in registry: ' + logicalTableName);
}

function getRequiredSheet_(spreadsheet, sheetName) {
  const sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) throw new Error('Sheet not found: ' + sheetName);
  return sheet;
}

function normalizeHeader_(value) {
  return String(value || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function normalizeCode_(value) {
  return String(value || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}

function parseBoolean_(value) {
  return value === true || String(value || '').trim().toUpperCase() === 'TRUE';
}
```

Example usage:

```javascript
const spreadsheet = openLogicalTableSpreadsheet_('Dinantia');
const sheet = getRequiredSheet_(spreadsheet, 'teachers_2_dinantia');
const values = sheet.getDataRange().getValues();
```

## Known Logical Tables

| Logical table | Known sheets |
| --- | --- |
| `Dades de professors` | `Llista`, `leave_absence` |
| `Càrrega lectiva` | `assignatures`, `carrecs` |
| `Horaris` | `GPU001` |
| `Dinantia` | `dinantia_2_dades_alumnes`, `teachers_2_dinantia`, `contacts_cache` |
| `Grades` | `subjects_cache`, `avaluacions`, generated or task-specific sheets |

Note: when writing Apps Script code or user-facing table references, preserve the exact registered logical table name, including accents, if the registry uses them.

## Rules

1. Always resolve logical tables through `db -> tables`.
2. Never hardcode spreadsheet IDs unless the user explicitly provides one for a special case.
3. Do not confuse logical table names, sheet/tab names, spreadsheet names, and spreadsheet IDs.
4. Treat `Logical table -> sheet` as the canonical notation.
5. Prefer reading columns by header name, not fixed letters.
6. Row 1 is normally the header row, and data normally starts in row 2.
7. Only use fixed column positions for sheets explicitly known to be headerless.
8. Header matching should be tolerant of spaces, case, and accents when possible.
9. Boolean readers should accept both real boolean `true` and string `"TRUE"`.
10. Do not log, display, or commit secrets.

The universal chain is:

```text
current Apps Script project
-> script property db
-> registry spreadsheet
-> sheet tables
-> logical table row
-> spreadsheet ID
-> actual spreadsheet
-> requested sheet/tab
-> rows and columns
```
