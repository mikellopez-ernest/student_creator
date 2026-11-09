const WITHDRAWAL_CACHE_SHEET_NAME_ = 'students_cache';
const WITHDRAWAL_STUDENT_REGISTRY_TABLE_ = 'Dades alumnes';
const WITHDRAWAL_ALLOWED_REGISTRY_SHEETS_ = [
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

function getWithdrawalGroups() {
  assertUserAccess_();

  const seen = {};
  return loadWithdrawalCacheRows_()
    .map(function(row) {
      return row.groupName;
    })
    .filter(function(groupName) {
      const key = normalizeHeader_(groupName);
      if (!key || seen[key]) return false;
      seen[key] = true;
      return true;
    })
    .sort(function(a, b) {
      return a.localeCompare(b, 'ca');
    });
}

function getWithdrawalStudents(groupName) {
  assertUserAccess_();

  const selectedGroup = cleanText_(groupName);
  requireField_(selectedGroup, 'Selecciona el grup');

  const studentsById = {};
  loadWithdrawalCacheRows_().forEach(function(row) {
    if (row.groupName !== selectedGroup) return;

    if (!studentsById[row.studentId]) {
      studentsById[row.studentId] = {
        studentId: row.studentId,
        studentName: row.studentName,
        studentEmail: row.studentEmail
      };
    }
  });

  return Object.keys(studentsById)
    .map(function(studentId) {
      return studentsById[studentId];
    })
    .sort(function(a, b) {
      return (a.studentName || a.studentId).localeCompare(b.studentName || b.studentId, 'ca');
    });
}

function withdrawStudent(payload) {
  const access = assertUserAccess_();
  const selectedGroup = cleanText_(payload && payload.groupName);
  const studentId = cleanText_(payload && payload.studentId);

  requireField_(selectedGroup, 'Selecciona el grup');
  requireField_(studentId, 'Alumnes');

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    console.log(JSON.stringify({
      event: 'withdrawStudent:start',
      studentId: studentId,
      groupName: selectedGroup,
      requestedBy: access.email
    }));

    const cacheStudent = getWithdrawalCacheStudent_(selectedGroup, studentId);
    const registry = findWithdrawalRegistryRow_(studentId, cacheStudent.studentDataSheet);
    const notificationConfig = getWithdrawalNotificationConfig_(cacheStudent, registry);

    if (registry.isWithdrawal) {
      throw new Error('L alumne ja consta com a baixa a Dades alumnes. No s ha eliminat res de Dinantia.');
    }

    // This request is a deliberate preflight. A missing account stops the workflow
    // before the permanent student registry is changed.
    getDinantiaAccount_(studentId);

    deleteDinantiaAccount_(studentId);

    const withdrawalDate = new Date();
    registry.sheet.getRange(registry.rowNumber, 11).setValue(true);
    registry.sheet.getRange(registry.rowNumber, 13).setValue(withdrawalDate);
    SpreadsheetApp.flush();

    const verification = registry.sheet.getRange(registry.rowNumber, 11, 1, 3).getValues()[0];
    if (!parseBoolean_(verification[0]) || !(verification[2] instanceof Date)) {
      throw new Error(
        'L alumne s ha eliminat de Dinantia, pero no s ha pogut verificar la baixa a Dades alumnes. ' +
        'Cal revisar manualment el full ' + registry.sheetName + ', fila ' + registry.rowNumber + '.'
      );
    }

    const deletedCacheRows = deleteStudentFromWithdrawalCache_(studentId);

    const result = {
      studentId: studentId,
      studentName: cacheStudent.studentName || registry.studentName,
      studentEmail: cacheStudent.studentEmail || registry.studentEmail,
      groupName: selectedGroup,
      sheetName: registry.sheetName,
      rowNumber: registry.rowNumber,
      course: notificationConfig.course,
      deletedCacheRows: deletedCacheRows,
      withdrawalDate: withdrawalDate,
      requestedBy: access.email
    };

    sendWithdrawalNotification_(result, notificationConfig);

    console.log(JSON.stringify({
      event: 'withdrawStudent:complete',
      studentId: studentId,
      sheetName: registry.sheetName,
      rowNumber: registry.rowNumber,
      deletedCacheRows: deletedCacheRows
    }));

    return {
      ok: true,
      message: 'La baixa s ha completat correctament.',
      studentId: studentId,
      sheetName: registry.sheetName,
      rowNumber: registry.rowNumber,
      deletedCacheRows: deletedCacheRows
    };
  } finally {
    lock.releaseLock();
  }
}

function deleteStudentFromWithdrawalCache_(studentId) {
  const spreadsheet = openLogicalTableSpreadsheet_(NEW_STUDENT_TABLE_NAME_);
  const sheet = getRequiredSheet_(spreadsheet, WITHDRAWAL_CACHE_SHEET_NAME_);
  const headers = getHeaderIndexMap_(sheet);
  const studentIdIndex = headers[normalizeHeader_('student_id')];

  if (studentIdIndex === undefined) {
    throw new Error('Required header not found in sheet "' + WITHDRAWAL_CACHE_SHEET_NAME_ + '": student_id');
  }

  const lastRow = sheet.getLastRow();
  const rowNumbers = [];
  if (lastRow >= 2) {
    const ids = sheet.getRange(2, studentIdIndex + 1, lastRow - 1, 1).getDisplayValues();
    ids.forEach(function(row, index) {
      if (cleanText_(row[0]) === studentId) rowNumbers.push(index + 2);
    });
  }

  rowNumbers.sort(function(a, b) { return b - a; }).forEach(function(rowNumber) {
    sheet.deleteRow(rowNumber);
  });
  SpreadsheetApp.flush();

  const remainingLastRow = sheet.getLastRow();
  if (remainingLastRow >= 2) {
    const remainingIds = sheet
      .getRange(2, studentIdIndex + 1, remainingLastRow - 1, 1)
      .getDisplayValues();
    const remains = remainingIds.some(function(row) {
      return cleanText_(row[0]) === studentId;
    });
    if (remains) {
      throw new Error(
        'La baixa s ha registrat, pero encara queden files de l alumne a students_cache. ' +
        'Cal revisar la cache manualment.'
      );
    }
  }

  return rowNumbers.length;
}

function loadWithdrawalCacheRows_() {
  const spreadsheet = openLogicalTableSpreadsheet_(NEW_STUDENT_TABLE_NAME_);
  const sheet = getRequiredSheet_(spreadsheet, WITHDRAWAL_CACHE_SHEET_NAME_);
  const headers = getHeaderIndexMap_(sheet);
  const requiredHeaders = [
    'student_id',
    'student_name',
    'student_email',
    'group_name',
    'student_data_sheet'
  ];

  requiredHeaders.forEach(function(header) {
    if (headers[normalizeHeader_(header)] === undefined) {
      throw new Error('Required header not found in sheet "' + WITHDRAWAL_CACHE_SHEET_NAME_ + '": ' + header);
    }
  });

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  return sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getDisplayValues()
    .map(function(row) {
      return {
        studentId: cleanText_(row[headers[normalizeHeader_('student_id')]]),
        studentName: cleanText_(row[headers[normalizeHeader_('student_name')]]),
        studentEmail: cleanText_(row[headers[normalizeHeader_('student_email')]]).toLowerCase(),
        groupName: cleanText_(row[headers[normalizeHeader_('group_name')]]),
        studentDataSheet: cleanText_(row[headers[normalizeHeader_('student_data_sheet')]])
      };
    })
    .filter(function(row) {
      return row.studentId && row.studentName && row.groupName;
    });
}

function getWithdrawalCacheStudent_(groupName, studentId) {
  const matches = loadWithdrawalCacheRows_().filter(function(row) {
    return row.groupName === groupName && row.studentId === studentId;
  });

  if (!matches.length) {
    throw new Error('L alumne seleccionat ja no consta al grup indicat a students_cache. Actualitza la pagina.');
  }

  const identityKeys = {};
  matches.forEach(function(row) {
    identityKeys[
      [row.studentName, row.studentEmail, row.studentDataSheet].map(normalizeHeader_).join('|')
    ] = true;
  });
  if (Object.keys(identityKeys).length !== 1) {
    throw new Error('students_cache conte dades contradictories per a l alumne seleccionat.');
  }

  if (!matches[0].studentDataSheet) {
    throw new Error('students_cache no informa student_data_sheet per a l alumne seleccionat.');
  }

  return matches[0];
}

function findWithdrawalRegistryRow_(studentId, expectedSheetName) {
  const spreadsheet = openLogicalTableSpreadsheet_(WITHDRAWAL_STUDENT_REGISTRY_TABLE_);
  const matches = [];

  WITHDRAWAL_ALLOWED_REGISTRY_SHEETS_.forEach(function(sheetName) {
    const sheet = getRequiredSheet_(spreadsheet, sheetName);
    validateWithdrawalRegistrySchema_(sheet);
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return;

    const ids = sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues();
    ids.forEach(function(row, index) {
      if (cleanText_(row[0]) === studentId) {
        matches.push({
          sheet: sheet,
          sheetName: sheetName,
          rowNumber: index + 2
        });
      }
    });
  });

  if (!matches.length) {
    throw new Error('No s ha trobat l alumne a Dades alumnes. No s ha eliminat res de Dinantia.');
  }
  if (matches.length !== 1) {
    throw new Error('L alumne apareix mes d una vegada a Dades alumnes. No s ha eliminat res de Dinantia.');
  }

  const match = matches[0];
  if (normalizeHeader_(match.sheetName) !== normalizeHeader_(expectedSheetName)) {
    throw new Error(
      'students_cache indica el full "' + expectedSheetName + '", pero l alumne es al full "' +
      match.sheetName + '". No s ha eliminat res de Dinantia.'
    );
  }

  const values = match.sheet.getRange(match.rowNumber, 1, 1, 13).getValues()[0];
  const displayValues = match.sheet.getRange(match.rowNumber, 1, 1, 13).getDisplayValues()[0];
  match.studentEmail = cleanText_(displayValues[1]).toLowerCase();
  match.studentName = cleanText_(displayValues[2]);
  match.course = cleanText_(displayValues[6]);
  match.initialClass = cleanText_(displayValues[7]);
  match.finalClass = cleanText_(displayValues[8]);
  match.isWithdrawal = parseBoolean_(values[10]);
  return match;
}

function validateWithdrawalRegistrySchema_(sheet) {
  const expected = {
    1: 'id',
    2: 'correu alumne',
    3: 'cognoms, nom',
    7: 'curs',
    8: 'classe inicial',
    9: 'classe definitiva',
    11: 'nova baixa?',
    13: 'data baixa'
  };
  const headers = sheet.getRange(1, 1, 1, 13).getDisplayValues()[0];

  Object.keys(expected).forEach(function(columnNumber) {
    const column = Number(columnNumber);
    if (normalizeHeader_(headers[column - 1]) !== normalizeHeader_(expected[column])) {
      throw new Error('Estructura inesperada al full ' + sheet.getName() + ', columna ' + column + '.');
    }
  });
}

function getWithdrawalNotificationConfig_(cacheStudent, registry) {
  const candidates = buildWithdrawalCourseCandidates_(cacheStudent, registry);
  const spreadsheet = openLogicalTableSpreadsheet_(NEW_STUDENT_TABLE_NAME_);
  const sheet = getRequiredSheet_(spreadsheet, NEW_STUDENT_CONFIG_SHEET_NAME_);
  const headers = getHeaderIndexMap_(sheet);
  ['courses', 'email_coord', 'email_digi'].forEach(function(header) {
    if (headers[normalizeHeader_(header)] === undefined) {
      throw new Error('Required header not found in sheet "' + NEW_STUDENT_CONFIG_SHEET_NAME_ + '": ' + header);
    }
  });

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) throw new Error('No hi ha cap curs configurat.');

  const rows = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getDisplayValues();
  let match = null;
  candidates.some(function(candidate) {
    match = rows.map(function(row) {
      return {
        course: cleanText_(row[headers[normalizeHeader_('courses')]]),
        emailCoord: cleanText_(row[headers[normalizeHeader_('email_coord')]]).toLowerCase(),
        emailDigi: cleanText_(row[headers[normalizeHeader_('email_digi')]]).toLowerCase()
      };
    }).find(function(row) {
      return normalizeHeader_(row.course) === normalizeHeader_(candidate);
    }) || null;
    return Boolean(match);
  });

  if (!match) {
    throw new Error('No s ha pogut determinar la configuracio de correu del nivell de l alumne.');
  }
  requireWithdrawalEmail_(match.emailCoord, 'email_coord');
  requireWithdrawalEmail_(match.emailDigi, 'email_digi');
  return match;
}

function buildWithdrawalCourseCandidates_(cacheStudent, registry) {
  const candidates = [];
  const add = function(value) {
    const text = cleanText_(value);
    if (!text) return;
    const key = normalizeHeader_(text);
    if (!candidates.some(function(candidate) { return normalizeHeader_(candidate) === key; })) {
      candidates.push(text);
    }
  };
  const combined = normalizeHeader_([
    cacheStudent.groupName,
    registry.course,
    registry.initialClass,
    registry.finalClass,
    registry.sheetName
  ].join(' '));

  if (/\bsiei\b/.test(combined)) add('SIEI');
  ['1r', '2n', '3r', '4t'].forEach(function(year) {
    if (combined.indexOf(year + ' eso') !== -1) add(year + ' ESO');
  });
  ['1r', '2n'].forEach(function(year) {
    if (combined.indexOf(year + ' bat') !== -1 || combined.indexOf('batx ' + year) !== -1) {
      add(year + ' BAT');
      add(year + ' Batx');
    }
    ['smx', 'pcc', 'ac'].forEach(function(code) {
      if (combined.indexOf(year + ' ' + code) !== -1 || combined.indexOf(code + ' ' + year) !== -1) {
        add(year + ' ' + code.toUpperCase());
      }
    });
  });
  if (/\bpfi\b/.test(combined)) add('PFI');
  add(registry.course);
  add(registry.sheetName);
  return candidates;
}

function requireWithdrawalEmail_(email, label) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanText_(email))) {
    throw new Error('El valor de ' + label + ' no es un correu valid per al nivell seleccionat.');
  }
}

function sendWithdrawalNotification_(result, config) {
  const recipients = uniqueEmails_([
    DIRECTIVE_TEAM_EMAIL_,
    config.emailCoord,
    config.emailDigi,
    SECRETARIA_EMAIL_
  ]);
  recipients.forEach(function(email) {
    requireWithdrawalEmail_(email, 'destinatari de la notificacio');
  });

  const formattedDate = Utilities.formatDate(
    result.withdrawalDate,
    Session.getScriptTimeZone(),
    'dd/MM/yyyy HH:mm'
  );
  const body = [
    'S ha completat una baixa d alumne.',
    '',
    'Alumne: ' + result.studentName,
    'Identificador: ' + result.studentId,
    'Correu institucional: ' + (result.studentEmail || '-'),
    'Grup seleccionat: ' + result.groupName,
    'Nivell: ' + result.course,
    'Dades alumnes: ' + result.sheetName + ', fila ' + result.rowNumber,
    'Data de baixa: ' + formattedDate,
    'Tramitada per: ' + result.requestedBy,
    '',
    'Accions completades:',
    '- Alumne eliminat de Dinantia.',
    '- Nova baixa marcada a Dades alumnes.',
    '- Data de baixa registrada.',
    '- Files eliminades de students_cache: ' + result.deletedCacheRows + '.'
  ].join('\n');

  MailApp.sendEmail({
    to: recipients.join(','),
    subject: 'Baixa d alumne completada: ' + result.studentName,
    body: body
  });
}
