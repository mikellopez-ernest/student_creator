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

function getHeaderIndexMap_(sheet) {
  const lastColumn = sheet.getLastColumn();
  if (!lastColumn) throw new Error('Sheet has no header row: ' + sheet.getName());

  const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  return headers.reduce(function(map, header, index) {
    const key = normalizeHeader_(header);
    if (key) map[key] = index;
    return map;
  }, {});
}

function requireHeaders_(sheet, headers) {
  const headerIndexMap = getHeaderIndexMap_(sheet);
  headers.forEach(function(header) {
    const key = normalizeHeader_(header);
    if (!(key in headerIndexMap)) {
      throw new Error('Required header not found in sheet "' + sheet.getName() + '": ' + header);
    }
  });
  return headerIndexMap;
}

function setCellByHeader_(sheet, rowNumber, headerName, value) {
  const headerIndexMap = requireHeaders_(sheet, [headerName]);
  sheet.getRange(rowNumber, headerIndexMap[normalizeHeader_(headerName)] + 1).setValue(value);
}

function normalizeHeader_(value) {
  return String(value || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function normalizeText_(value) {
  return String(value || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function normalizeCode_(value) {
  return normalizeText_(value).toUpperCase();
}

function normalizeEmailLocalPart_(value) {
  return normalizeText_(value)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function parseBoolean_(value) {
  return value === true || String(value || '').trim().toUpperCase() === 'TRUE';
}

function cleanText_(value) {
  return String(value || '').trim();
}
