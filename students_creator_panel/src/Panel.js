function doGet() {
  requireAdmin_();

  return HtmlService
    .createHtmlOutputFromFile('AdminPanel')
    .setTitle('Gestio de noves incorporacions')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getPanelData() {
  requireAdmin_();

  logPanelStep_('getPanelData:start');
  const rows = getPendingStudentRows_();
  const groups = dinantiaListGroups_();
  logPanelStep_('getPanelData:success', {
    rows: rows.length,
    groups: groups.length
  });

  return {
    rows: rows,
    groups: groups
  };
}

function getPendingStudentRows_() {
  const dinantiaSpreadsheet = openLogicalTableSpreadsheet_(CONFIG_.dinantiaLogicalTable);
  const studentSheet = getRequiredSheet_(dinantiaSpreadsheet, CONFIG_.studentSheetName);
  const contactsSheet = getRequiredSheet_(dinantiaSpreadsheet, CONFIG_.contactsSheetName);

  const studentHeaderMap = requireHeaders_(studentSheet, ['id', 'name', 'surname1', 'surname2', 'level', 'managed']);
  const contactsByStudentId = getContactsByStudentId_(contactsSheet);
  const lastRow = studentSheet.getLastRow();

  if (lastRow < 2) return [];

  const values = studentSheet.getRange(2, 1, lastRow - 1, studentSheet.getLastColumn()).getValues();

  return values
    .map(function(row, index) {
      const student = {
        rowNumber: index + 2,
        id: cleanText_(row[studentHeaderMap.id]),
        name: cleanText_(row[studentHeaderMap.name]),
        surname1: cleanText_(row[studentHeaderMap.surname1]),
        surname2: cleanText_(row[studentHeaderMap.surname2]),
        level: cleanText_(row[studentHeaderMap.level]),
        managed: row[studentHeaderMap.managed]
      };

      student.fullName = buildFullName_(student);
      student.suggestedEmail = generateSuggestedStudentEmail_(student);
      student.contacts = contactsByStudentId[student.id] || [];
      return student;
    })
    .filter(function(student) {
      return !parseBoolean_(student.managed);
    });
}

function getContactsByStudentId_(contactsSheet) {
  const headerMap = requireHeaders_(contactsSheet, ['id', 'full_name', 'email', 'phone', 'relation']);
  const lastRow = contactsSheet.getLastRow();
  const grouped = {};

  if (lastRow < 2) return grouped;

  const values = contactsSheet.getRange(2, 1, lastRow - 1, contactsSheet.getLastColumn()).getValues();
  values.forEach(function(row, index) {
    const id = cleanText_(row[headerMap.id]);
    if (!id) return;

    if (!grouped[id]) grouped[id] = [];
    grouped[id].push({
      rowNumber: index + 2,
      fullName: cleanText_(row[headerMap.full_name]),
      email: cleanText_(row[headerMap.email]).toLowerCase(),
      phone: cleanText_(row[headerMap.phone]),
      relation: cleanText_(row[headerMap.relation])
    });
  });

  return grouped;
}

function createStudentAccounts(request) {
  requireAdmin_();

  let rowNumber = '';
  let studentId = '';

  try {
    const payload = request || {};
    rowNumber = Number(payload.rowNumber);
    const institutionalEmail = normalizeInstitutionalEmail_(payload.institutionalEmail);
    const groupIds = normalizeSelectedGroupIds_(payload.groupIds);

    logPanelStep_('createStudentAccounts:start', {
      rowNumber: rowNumber,
      institutionalEmail: institutionalEmail,
      groupIds: groupIds,
      submittedContacts: Array.isArray(payload.contacts) ? payload.contacts.length : 0
    });

    if (!rowNumber || rowNumber < 2) throw new Error('Fila no valida.');
    if (!groupIds.length) throw new Error('Cal seleccionar almenys un grup de Dinantia.');

    const context = getStudentContextByRow_(rowNumber);
    const student = context.student;
    studentId = student.id;
    logPanelStep_('createStudentAccounts:contextLoaded', {
      rowNumber: rowNumber,
      studentId: student.id,
      level: student.level,
      existingContacts: context.contacts.length
    });

    const contacts = sanitizeEditableContacts_(payload.contacts, context.contacts, student.id);
    logPanelStep_('createStudentAccounts:contactsSanitized', {
      rowNumber: rowNumber,
      studentId: student.id,
      contacts: contacts.length
    });

    const dinantiaGroups = dinantiaListGroups_();
    logPanelStep_('createStudentAccounts:dinantiaGroupsLoaded', {
      rowNumber: rowNumber,
      studentId: student.id,
      groups: dinantiaGroups.length
    });

    const studentConfig = getNewStudentConfigByCourse_(student.level);
    logPanelStep_('createStudentAccounts:courseConfigLoaded', {
      rowNumber: rowNumber,
      studentId: student.id,
      level: student.level,
      hasEmailCoord: Boolean(studentConfig.emailCoord),
      hasEmailDigi: Boolean(studentConfig.emailDigi)
    });

    validateStudentForCreation_(student, contacts, institutionalEmail, groupIds, dinantiaGroups);
    logPanelStep_('createStudentAccounts:validated', {
      rowNumber: rowNumber,
      studentId: student.id
    });

    updateContactRows_(context.contactsSheet, contacts);
    logPanelStep_('createStudentAccounts:contactsUpdated', {
      rowNumber: rowNumber,
      studentId: student.id
    });

    const googleUser = createGoogleStudentUser_(student, institutionalEmail, contacts);
    logPanelStep_('createStudentAccounts:googleUserCreated', {
      rowNumber: rowNumber,
      studentId: student.id,
      googleUserId: googleUser.id || '',
      institutionalEmail: institutionalEmail
    });

    createDinantiaStudent_(student, contacts, groupIds, institutionalEmail);
    logPanelStep_('createStudentAccounts:dinantiaUserCreated', {
      rowNumber: rowNumber,
      studentId: student.id
    });

    sendStudentCreatedNotification_(student, contacts, institutionalEmail, groupIds, dinantiaGroups, studentConfig);
    logPanelStep_('createStudentAccounts:notificationSent', {
      rowNumber: rowNumber,
      studentId: student.id
    });

    setCellByHeader_(context.studentSheet, rowNumber, 'managed', true);
    logPanelStep_('createStudentAccounts:managedSet', {
      rowNumber: rowNumber,
      studentId: student.id
    });

    return {
      ok: true,
      message: 'Alumne creat correctament.',
      googleUserId: googleUser.id || '',
      email: institutionalEmail,
      studentId: student.id
    };
  } catch (error) {
    logPanelError_('createStudentAccounts:failed', error, {
      rowNumber: rowNumber,
      studentId: studentId
    });
    throw error;
  }
}

function getStudentContextByRow_(rowNumber) {
  const dinantiaSpreadsheet = openLogicalTableSpreadsheet_(CONFIG_.dinantiaLogicalTable);
  const studentSheet = getRequiredSheet_(dinantiaSpreadsheet, CONFIG_.studentSheetName);
  const contactsSheet = getRequiredSheet_(dinantiaSpreadsheet, CONFIG_.contactsSheetName);
  const studentHeaderMap = requireHeaders_(studentSheet, ['id', 'name', 'surname1', 'surname2', 'level', 'managed']);

  if (rowNumber > studentSheet.getLastRow()) {
    throw new Error('La fila ja no existeix.');
  }

  const row = studentSheet.getRange(rowNumber, 1, 1, studentSheet.getLastColumn()).getValues()[0];
  const student = {
    rowNumber: rowNumber,
    id: cleanText_(row[studentHeaderMap.id]),
    name: cleanText_(row[studentHeaderMap.name]),
    surname1: cleanText_(row[studentHeaderMap.surname1]),
    surname2: cleanText_(row[studentHeaderMap.surname2]),
    level: cleanText_(row[studentHeaderMap.level]),
    managed: row[studentHeaderMap.managed]
  };
  student.fullName = buildFullName_(student);

  if (parseBoolean_(student.managed)) {
    throw new Error('Aquest alumne ja consta com a gestionat.');
  }

  return {
    studentSheet: studentSheet,
    contactsSheet: contactsSheet,
    student: student,
    contacts: getContactsByStudentId_(contactsSheet)[student.id] || []
  };
}

function validateStudentForCreation_(student, contacts, institutionalEmail, groupIds, dinantiaGroups) {
  requireField_(student.id, 'Identificador');
  requireField_(student.name, 'Nom');
  requireField_(student.surname1, 'Cognom 1');
  requireField_(student.level, 'Nivell');

  if (googleUserExists_(institutionalEmail)) {
    throw new Error('Ja existeix un usuari Google amb aquest correu.');
  }

  if (dinantiaAccountExists_(student.id)) {
    throw new Error('Ja existeix un usuari Dinantia amb aquest identificador.');
  }

  const availableGroupIds = dinantiaGroups.map(function(group) {
    return group.id;
  });
  const missingGroups = groupIds.filter(function(groupId) {
    return availableGroupIds.indexOf(groupId) === -1;
  });

  if (missingGroups.length) {
    throw new Error('Hi ha grups Dinantia no valids: ' + missingGroups.join(', '));
  }

  contacts.forEach(function(contact, index) {
    requireField_(contact.fullName, 'Nom complet familiar ' + (index + 1));
    requireField_(contact.email, 'Correu familiar ' + (index + 1));
    requireField_(contact.phone, 'Telefon familiar ' + (index + 1));
    requireField_(contact.relation, 'Relacio familiar ' + (index + 1));

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) {
      throw new Error('El correu del familiar ' + (index + 1) + ' no es valid.');
    }
  });
}

function normalizeSelectedGroupIds_(groupIds) {
  if (!Array.isArray(groupIds)) return [];

  const seen = {};
  return groupIds
    .map(cleanText_)
    .filter(function(groupId) {
      if (!groupId || seen[groupId]) return false;
      seen[groupId] = true;
      return true;
    });
}

function buildFullName_(student) {
  return [student.name, student.surname1, student.surname2].filter(Boolean).join(' ');
}

function requireField_(value, label) {
  if (!cleanText_(value)) {
    throw new Error('Camp obligatori pendent: ' + label + '.');
  }
}

function normalizePhoneForDinantia_(value) {
  const compact = cleanText_(value).replace(/[\s.-]/g, '');

  if (/^[6789]\d{8}$/.test(compact)) {
    return '+34' + compact;
  }

  if (/^34[6789]\d{8}$/.test(compact)) {
    return '+' + compact;
  }

  if (/^\+34[6789]\d{8}$/.test(compact)) {
    return compact;
  }

  throw new Error('El telefon ha de tenir 9 numeros i comencar per 6, 7, 8 o 9: ' + cleanText_(value) + '.');
}

function sanitizeEditableContacts_(submittedContacts, existingContacts, studentId) {
  const existingByRow = {};
  existingContacts.forEach(function(contact) {
    existingByRow[String(contact.rowNumber)] = contact;
  });

  if (!Array.isArray(submittedContacts)) {
    return existingContacts.map(function(contact) {
      return sanitizeOneContact_(contact, contact.rowNumber, studentId);
    });
  }

  return submittedContacts.map(function(contact, index) {
    const rowNumber = Number(contact && contact.rowNumber);
    if (!rowNumber || !existingByRow[String(rowNumber)]) {
      throw new Error('El familiar ' + (index + 1) + ' no correspon a aquesta sol licitud.');
    }

    const existing = existingByRow[String(rowNumber)];
    return sanitizeOneContact_({
      rowNumber: rowNumber,
      fullName: contact.fullName,
      email: contact.email,
      phone: contact.phone,
      relation: existing.relation
    }, rowNumber, studentId);
  });
}

function sanitizeOneContact_(contact, rowNumber, studentId) {
  return {
    rowNumber: rowNumber,
    id: studentId,
    fullName: cleanText_(contact.fullName),
    email: cleanText_(contact.email).toLowerCase(),
    phone: normalizePhoneForDinantia_(contact.phone),
    relation: cleanText_(contact.relation)
  };
}

function updateContactRows_(contactsSheet, contacts) {
  const headerMap = requireHeaders_(contactsSheet, ['full_name', 'email', 'phone']);

  contacts.forEach(function(contact) {
    contactsSheet.getRange(contact.rowNumber, headerMap.full_name + 1).setValue(contact.fullName);
    contactsSheet.getRange(contact.rowNumber, headerMap.email + 1).setValue(contact.email);
    contactsSheet.getRange(contact.rowNumber, headerMap.phone + 1).setNumberFormat('@').setValue(contact.phone);
  });
}

function getNewStudentConfigByCourse_(course) {
  const dinantiaSpreadsheet = openLogicalTableSpreadsheet_(CONFIG_.dinantiaLogicalTable);
  const sheet = getRequiredSheet_(dinantiaSpreadsheet, CONFIG_.configSheetName);
  const headerMap = requireHeaders_(sheet, ['courses', 'email_coord', 'email_digi']);
  const lastRow = sheet.getLastRow();
  const selectedCourse = cleanText_(course);

  if (lastRow < 2) {
    throw new Error('No hi ha cap configuracio de curs.');
  }

  const values = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
  const match = values
    .map(function(row) {
      return {
        course: cleanText_(row[headerMap.courses]),
        emailCoord: cleanText_(row[headerMap.email_coord]).toLowerCase(),
        emailDigi: cleanText_(row[headerMap.email_digi]).toLowerCase()
      };
    })
    .find(function(row) {
      return row.course === selectedCourse;
    });

  if (!match) {
    throw new Error('No hi ha configuracio per al nivell seleccionat: ' + selectedCourse + '.');
  }

  requireValidEmail_(match.emailCoord, 'email_coord');
  requireValidEmail_(match.emailDigi, 'email_digi');

  return match;
}

function sendStudentCreatedNotification_(student, contacts, institutionalEmail, groupIds, dinantiaGroups, studentConfig) {
  const recipients = uniqueEmails_([
    CONFIG_.directiveTeamEmail,
    studentConfig.emailCoord,
    studentConfig.emailDigi
  ]);

  MailApp.sendEmail({
    to: recipients.join(','),
    subject: 'Alumne creat: ' + buildFullName_(student),
    body: buildStudentCreatedNotificationBody_(student, contacts, institutionalEmail, groupIds, dinantiaGroups)
  });
}

function buildStudentCreatedNotificationBody_(student, contacts, institutionalEmail, groupIds, dinantiaGroups) {
  const groupSummaries = groupIds.map(function(groupId) {
    const group = dinantiaGroups.find(function(item) {
      return item.id === groupId;
    });
    if (!group) return groupId;
    return group.id + ' - ' + (group.tag || group.name || '');
  });

  const lines = [
    'S ha creat correctament una nova incorporacio.',
    '',
    'Dades de l alumne:',
    'Identificador: ' + student.id,
    'Nom complet: ' + buildFullName_(student),
    'Nom: ' + student.name,
    'Cognom 1: ' + student.surname1,
    'Cognom 2: ' + (student.surname2 || '-'),
    'Nivell: ' + student.level,
    '',
    'Usuari iernestlluch:',
    'Correu: ' + institutionalEmail,
    'Contrasenya inicial: ' + CONFIG_.initialStudentPassword,
    'Canvi de contrasenya al primer acces: si',
    '',
    'Grups Dinantia:',
    groupSummaries.length ? groupSummaries.join('\n') : '- Cap grup informat.',
    '',
    'Familiars:'
  ];

  if (!contacts.length) {
    lines.push('- Cap familiar informat.');
  } else {
    contacts.forEach(function(contact, index) {
      lines.push(
        '- Familiar ' + (index + 1) + ': ' + contact.fullName +
        ' | ' + contact.email +
        ' | ' + contact.phone +
        ' | ' + contact.relation
      );
    });
  }

  return lines.join('\n');
}

function requireValidEmail_(email, label) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanText_(email))) {
    throw new Error('El camp ' + label + ' de new_student_config no es valid.');
  }
}

function uniqueEmails_(emails) {
  const seen = {};
  return emails
    .map(function(email) {
      return cleanText_(email).toLowerCase();
    })
    .filter(function(email) {
      if (!email || seen[email]) return false;
      seen[email] = true;
      return true;
    });
}
