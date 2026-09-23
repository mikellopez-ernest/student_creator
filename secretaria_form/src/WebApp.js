const NEW_STUDENT_TABLE_NAME_ = 'Dinantia';
const NEW_STUDENT_SHEET_NAME_ = 'new_student_form';
const NEW_STUDENT_CONTACTS_SHEET_NAME_ = 'new_student_form_contacts';
const NEW_STUDENT_CONFIG_SHEET_NAME_ = 'new_student_config';
const DIRECTIVE_TEAM_EMAIL_ = 'equip_directiu@iernestlluch.cat';

function doGet() {
  const access = getAccessDecision_();
  if (!access.allowed) return createAccessDeniedOutput_(access);

  const template = HtmlService.createTemplateFromFile('NewStudentForm');
  template.courses = getNewStudentConfig_().map(function(config) {
    return config.course;
  });

  return template
    .evaluate()
    .setTitle('Creacio alumne nou')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function submitNewStudentForm(payload) {
  assertUserAccess_();

  const config = getNewStudentConfig_();
  const student = sanitizeStudentPayload_(payload);
  const contacts = sanitizeContactsPayload_(payload);
  findSelectedCourseConfig_(config, student.level);

  const dinantiaSpreadsheet = openLogicalTableSpreadsheet_(NEW_STUDENT_TABLE_NAME_);
  const studentSheet = getRequiredSheet_(dinantiaSpreadsheet, NEW_STUDENT_SHEET_NAME_);
  const contactsSheet = getRequiredSheet_(dinantiaSpreadsheet, NEW_STUDENT_CONTACTS_SHEET_NAME_);
  const commentHeader = getStudentCommentHeader_(studentSheet);
  const studentRow = {
    id: student.id,
    name: student.name,
    surname1: student.surname1,
    surname2: student.surname2,
    level: student.level
  };
  studentRow[commentHeader] = student.comment;

  appendObjectByHeaders_(studentSheet, studentRow, ['id', 'name', 'surname1', 'surname2', 'level', commentHeader]);

  contacts.forEach(function(contact) {
    appendObjectByHeaders_(contactsSheet, {
      id: student.id,
      full_name: contact.fullName,
      email: contact.email,
      phone: contact.phone,
      relation: contact.relation
    }, ['id', 'full_name', 'email', 'phone', 'relation']);
  });

  sendNewStudentNotification_(student, contacts);

  return {
    ok: true,
    message: 'Alumne desat correctament.',
    studentId: student.id,
    contacts: contacts.length
  };
}

function sanitizeStudentPayload_(payload) {
  const raw = payload || {};
  const student = {
    id: cleanText_(raw.id),
    name: cleanText_(raw.name),
    surname1: cleanText_(raw.surname1),
    surname2: cleanText_(raw.surname2),
    level: cleanText_(raw.level),
    comment: cleanText_(raw.comment)
  };

  requireField_(student.id, 'Identificador de l alumne');
  requireField_(student.name, 'Nom');
  requireField_(student.surname1, 'Cognom 1');
  requireField_(student.level, 'Nivell');

  return student;
}

function sanitizeContactsPayload_(payload) {
  const rawContacts = payload && Array.isArray(payload.contacts) ? payload.contacts : [];

  return rawContacts.map(function(rawContact, index) {
    const contact = {
      fullName: cleanText_(rawContact.fullName),
      email: cleanText_(rawContact.email).toLowerCase(),
      phone: normalizePhone_(rawContact.phone),
      relation: cleanText_(rawContact.relation)
    };

    requireField_(contact.fullName, 'Nom complet del familiar ' + (index + 1));
    requireField_(contact.email, 'Correu electronic del familiar ' + (index + 1));
    requireField_(contact.phone, 'Telefon del familiar ' + (index + 1));
    requireField_(contact.relation, 'Relacio del familiar ' + (index + 1));

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) {
      throw new Error('El correu electronic del familiar ' + (index + 1) + ' no es valid.');
    }

    if (['Mare', 'Pare', 'Un altre'].indexOf(contact.relation) === -1) {
      throw new Error('La relacio del familiar ' + (index + 1) + ' no es valida.');
    }

    return contact;
  });
}

function cleanText_(value) {
  return String(value || '').trim();
}

function requireField_(value, label) {
  if (!cleanText_(value)) {
    throw new Error('Camp obligatori pendent: ' + label + '.');
  }
}

function getNewStudentConfig_() {
  const dinantiaSpreadsheet = openLogicalTableSpreadsheet_(NEW_STUDENT_TABLE_NAME_);
  const sheet = getRequiredSheet_(dinantiaSpreadsheet, NEW_STUDENT_CONFIG_SHEET_NAME_);
  const headerIndexMap = getHeaderIndexMap_(sheet);
  const coursesIndex = headerIndexMap[normalizeHeader_('courses')];

  if (coursesIndex === undefined) {
    throw new Error('Required header not found in sheet "' + NEW_STUDENT_CONFIG_SHEET_NAME_ + '": courses');
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    throw new Error('No hi ha cap curs configurat.');
  }

  const values = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
  const config = values
    .map(function(row) {
      return {
        course: cleanText_(row[coursesIndex])
      };
    })
    .filter(function(row) {
      return row.course;
    });

  if (!config.length) {
    throw new Error('No hi ha cap curs configurat.');
  }

  return config;
}

function findSelectedCourseConfig_(config, selectedCourse) {
  const selected = cleanText_(selectedCourse);
  const match = config.find(function(row) {
    return row.course === selected;
  });

  if (!match) {
    throw new Error('El nivell seleccionat no es valid.');
  }

  return match;
}

function getStudentCommentHeader_(studentSheet) {
  const headerIndexMap = getHeaderIndexMap_(studentSheet);
  if (headerIndexMap[normalizeHeader_('comment')] !== undefined) return 'comment';
  if (headerIndexMap[normalizeHeader_('comments')] !== undefined) return 'comments';
  throw new Error('Required header not found in sheet "' + NEW_STUDENT_SHEET_NAME_ + '": comment');
}

function sendNewStudentNotification_(student, contacts) {
  const recipients = uniqueEmails_([
    DIRECTIVE_TEAM_EMAIL_
  ]);

  MailApp.sendEmail({
    to: recipients.join(','),
    subject: 'Nou alumne pendent de crear: ' + student.name + ' ' + student.surname1,
    body: buildNewStudentNotificationBody_(student, contacts)
  });
}

function buildNewStudentNotificationBody_(student, contacts) {
  const lines = [
    'S ha rebut una nova sol licitud de creacio d alumne.',
    '',
    'Dades de l alumne:',
    'Identificador: ' + student.id,
    'Nom: ' + student.name,
    'Cognom 1: ' + student.surname1,
    'Cognom 2: ' + (student.surname2 || '-'),
    'Nivell: ' + student.level,
    'Comentaris: ' + (student.comment || '-'),
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

function normalizePhone_(value) {
  const raw = cleanText_(value);
  const compact = raw.replace(/[\s.-]/g, '');

  if (/^[6789]\d{8}$/.test(compact)) {
    return '+34' + compact;
  }

  if (/^\+34[6789]\d{8}$/.test(compact)) {
    return compact;
  }

  throw new Error('El telefon ha de tenir 9 numeros i comencar per 6, 7, 8 o 9. Pots escriure, per exemple, 666221996 o +34666221996.');
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
