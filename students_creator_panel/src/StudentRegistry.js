const STUDENT_REGISTRY_ALLOWED_SHEETS_ = [
  '1r ESO',
  '2n ESO',
  '3r ESO',
  '4t ESO',
  '1r Batx',
  '2n Batx',
  'SMX',
  'PCC',
  'PFI',
  'AC'
];

function prepareStudentRegistryCreation_(student, contacts, institutionalEmail, groupIds, dinantiaGroups) {
  const placement = getStudentRegistryPlacement_(student.level);
  const className = resolveStudentRegistryClass_(placement, groupIds, dinantiaGroups);
  const spreadsheet = openLogicalTableSpreadsheet_(CONFIG_.studentRegistryLogicalTable);

  assertStudentRegistryIdAvailable_(spreadsheet, student.id);

  const sheet = getRequiredSheet_(spreadsheet, placement.sheetName);
  validateStudentRegistrySchema_(sheet);

  return {
    spreadsheet: spreadsheet,
    sheetName: placement.sheetName,
    courseLabel: placement.courseLabel,
    className: className,
    student: student,
    contacts: contacts,
    institutionalEmail: institutionalEmail
  };
}

function createStudentRegistryRow_(plan, googleUser) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    assertStudentRegistryIdAvailable_(plan.spreadsheet, plan.student.id);

    const sheet = getRequiredSheet_(plan.spreadsheet, plan.sheetName);
    validateStudentRegistrySchema_(sheet);

    const target = getStudentRegistryTargetRow_(sheet);
    const rowNumber = target.rowNumber;
    const contactEmails = getUniqueStudentRegistryContactEmails_(plan.contacts);
    const creationDate = getStudentRegistryCreationDate_(googleUser);

    target.templateRange.copyTo(
      sheet.getRange(rowNumber, 1, 1, sheet.getLastColumn()),
      SpreadsheetApp.CopyPasteType.PASTE_FORMAT,
      false
    );
    target.templateRange.copyTo(
      sheet.getRange(rowNumber, 1, 1, sheet.getLastColumn()),
      SpreadsheetApp.CopyPasteType.PASTE_DATA_VALIDATION,
      false
    );

    sheet.getRange(rowNumber, 1, 1, 2).setValues([[
      plan.student.id,
      plan.institutionalEmail
    ]]);
    sheet.getRange(target.templateRow, 3).copyTo(
      sheet.getRange(rowNumber, 3),
      SpreadsheetApp.CopyPasteType.PASTE_FORMULA,
      false
    );
    sheet.getRange(rowNumber, 4, 1, 12).setValues([[
      plan.student.surname1,
      plan.student.surname2,
      plan.student.name,
      plan.courseLabel,
      plan.className,
      plan.className,
      true,
      false,
      creationDate,
      '',
      '',
      ''
    ]]);
    sheet.getRange(rowNumber, 22, 1, 6).setValues([[
      contactEmails[0] || '',
      contactEmails[1] || '',
      '',
      false,
      false,
      ''
    ]]);

    SpreadsheetApp.flush();

    const values = sheet.getRange(rowNumber, 1, 1, 27).getDisplayValues()[0];
    if (cleanText_(values[0]) !== plan.student.id ||
        cleanText_(values[1]).toLowerCase() !== plan.institutionalEmail ||
        !cleanText_(values[2]) ||
        cleanText_(values[2]).indexOf('#') === 0) {
      throw new Error('No s ha pogut verificar el registre creat a Dades alumnes.');
    }

    return {
      sheetName: sheet.getName(),
      rowNumber: rowNumber,
      displayName: cleanText_(values[2]),
      institutionalEmail: cleanText_(values[1]).toLowerCase(),
      className: plan.className
    };
  } finally {
    lock.releaseLock();
  }
}

function getGoogleUserForStudentRegistry_(institutionalEmail) {
  try {
    return AdminDirectory.Users.get(institutionalEmail);
  } catch (error) {
    if (isNotFoundError_(error)) {
      throw new Error('Cal crear primer el correu institucional abans de generar el registre de Dades alumnes.');
    }
    throw error;
  }
}

function getStudentRegistryPlacement_(level) {
  const key = normalizeHeader_(level);
  const placements = {
    '1r eso': { sheetName: '1r ESO', courseLabel: '1r ESO', classPattern: /^1r eso [a-z]$/i },
    '2n eso': { sheetName: '2n ESO', courseLabel: '2n ESO', classPattern: /^2n eso [a-z]$/i },
    '3r eso': { sheetName: '3r ESO', courseLabel: '3r ESO', classPattern: /^3r eso [a-z]$/i },
    '4t eso': { sheetName: '4t ESO', courseLabel: '4t ESO', classPattern: /^4t eso [a-z]$/i },
    '1r bat': { sheetName: '1r Batx', courseLabel: '1r Bat', classPattern: /^batx 1r [a-z]$/i },
    '1r batx': { sheetName: '1r Batx', courseLabel: '1r Bat', classPattern: /^batx 1r [a-z]$/i },
    '2n bat': { sheetName: '2n Batx', courseLabel: '2n Bat', classPattern: /^batx 2n [a-z]$/i },
    '2n batx': { sheetName: '2n Batx', courseLabel: '2n Bat', classPattern: /^batx 2n [a-z]$/i },
    '1r smx': { sheetName: 'SMX', courseLabel: 'SMX', classPattern: /^smx 1r$/i },
    '2n smx': { sheetName: 'SMX', courseLabel: 'SMX', classPattern: /^smx 2n$/i },
    '1r pcc': { sheetName: 'PCC', courseLabel: 'PCC', classPattern: /^pcc 1r$/i },
    '2n pcc': { sheetName: 'PCC', courseLabel: 'PCC', classPattern: /^pcc 2n$/i },
    'pfi': { sheetName: 'PFI', courseLabel: 'PFI', classPattern: /^pfi$/i },
    '1r ac': { sheetName: 'AC', courseLabel: 'AC', classPattern: /^ac 1r$/i },
    '2n ac': { sheetName: 'AC', courseLabel: 'AC', classPattern: /^ac 2n$/i }
  };

  if (!placements[key]) {
    throw new Error('El nivell "' + cleanText_(level) + '" no te un full de destinacio a Dades alumnes 2026-2027.');
  }
  return placements[key];
}

function resolveStudentRegistryClass_(placement, groupIds, dinantiaGroups) {
  const selected = {};
  groupIds.forEach(function(groupId) {
    selected[groupId] = true;
  });

  const matches = dinantiaGroups.map(function(group) {
    if (!selected[group.id]) return null;
    const labels = [group.tag, group.name, group.id].map(cleanText_).filter(Boolean);
    for (let index = 0; index < labels.length; index += 1) {
      if (placement.classPattern.test(normalizeHeader_(labels[index]))) return labels[index];
    }
    return null;
  }).filter(Boolean);

  const unique = [];
  const seen = {};
  matches.forEach(function(label) {
    const key = normalizeHeader_(label);
    if (seen[key]) return;
    seen[key] = true;
    unique.push(label);
  });

  if (unique.length !== 1) {
    throw new Error('Cal seleccionar exactament un grup classe compatible amb el nivell per crear el registre de Dades alumnes.');
  }
  return unique[0];
}

function assertStudentRegistryIdAvailable_(spreadsheet, studentId) {
  STUDENT_REGISTRY_ALLOWED_SHEETS_.forEach(function(sheetName) {
    const sheet = getRequiredSheet_(spreadsheet, sheetName);
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return;

    const ids = sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues();
    const exists = ids.some(function(row) {
      return cleanText_(row[0]) === cleanText_(studentId);
    });
    if (exists) {
      throw new Error('L alumne ja existeix a Dades alumnes, full ' + sheetName + '.');
    }
  });
}

function validateStudentRegistrySchema_(sheet) {
  const expected = {
    1: 'id',
    2: 'correu alumne',
    3: 'cognoms, nom',
    4: 'cognom1',
    5: 'cognom2',
    6: 'nom',
    7: 'curs',
    8: 'classe inicial',
    9: 'classe definitiva',
    10: 'nova alta?',
    11: 'nova baixa?',
    12: 'data alta',
    22: 'correu tutor1',
    23: 'correu tutor2',
    25: 'baixalogica',
    26: 'problema alta',
    27: 'data naixement'
  };
  const headers = sheet.getRange(1, 1, 1, 27).getDisplayValues()[0];

  Object.keys(expected).forEach(function(columnNumber) {
    const column = Number(columnNumber);
    if (normalizeHeader_(headers[column - 1]) !== normalizeHeader_(expected[column])) {
      throw new Error('Estructura inesperada al full ' + sheet.getName() + ', columna ' + column + '.');
    }
  });
}

function getStudentRegistryTargetRow_(sheet) {
  const maxRows = sheet.getMaxRows();
  const ids = sheet.getRange(2, 1, Math.max(1, maxRows - 1), 1).getDisplayValues();
  let templateRow = 0;

  ids.forEach(function(row, index) {
    if (cleanText_(row[0])) templateRow = index + 2;
  });
  if (templateRow < 2) {
    throw new Error('El full ' + sheet.getName() + ' no te cap fila model per copiar.');
  }

  let rowNumber = templateRow + 1;
  if (rowNumber > maxRows) {
    sheet.insertRowsAfter(maxRows, rowNumber - maxRows);
  } else {
    const occupiedValues = sheet.getRange(rowNumber, 1, 1, 27).getDisplayValues()[0].filter(function(value) {
      return cleanText_(value);
    });
    if (occupiedValues.length) {
      sheet.insertRowsAfter(maxRows, 1);
      rowNumber = maxRows + 1;
    }
  }

  return {
    rowNumber: rowNumber,
    templateRow: templateRow,
    templateRange: sheet.getRange(templateRow, 1, 1, sheet.getLastColumn())
  };
}

function getUniqueStudentRegistryContactEmails_(contacts) {
  const seen = {};
  return contacts.map(function(contact) {
    return cleanText_(contact.email).toLowerCase();
  }).filter(function(email) {
    if (!email || seen[email]) return false;
    seen[email] = true;
    return true;
  }).slice(0, 2);
}

function getStudentRegistryCreationDate_(googleUser) {
  const value = cleanText_(googleUser && googleUser.creationTime);
  const date = value ? new Date(value) : new Date();
  if (isNaN(date.getTime())) {
    throw new Error('La data de creacio del compte Google no es valida.');
  }
  return date;
}
