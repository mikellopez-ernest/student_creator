const ACCESS_CONFIG_ = {
  registryPropertyName: 'db',
  accessGrantedPropertyName: 'access_granted',
  workloadRegistryName: 'Càrrega lectiva',
  workloadProfessorsSheetName: 'professors',
  workloadCarrecsSheetName: 'carrecs'
};

const WORKLOAD_PROFESSORS_COLUMNS_ = {
  correuInstit: 12,
  teacherKey: 17
};

const CARRECS_COLUMNS_ = {
  carrec: 1,
  asignado: 4
};

function assertUserAccess_() {
  const access = getAccessDecision_();
  if (!access.allowed) {
    throw new Error(access.message);
  }
  return access;
}

function getAccessDecision_() {
  try {
    const userEmail = normalizeAccessEmail_(Session.getActiveUser().getEmail());
    if (!userEmail) {
      return {
        allowed: false,
        email: '',
        message: 'No s ha pogut identificar el correu de l usuari actiu.'
      };
    }

    const accessEntries = getAccessGrantedEntries_();
    if (!accessEntries.length) {
      return {
        allowed: false,
        email: userEmail,
        message: 'Falta configurar la propietat de script "' + ACCESS_CONFIG_.accessGrantedPropertyName + '".'
      };
    }

    const directEmails = accessEntries
      .map(normalizeAccessEmail_)
      .filter(function(entry) {
        return entry.indexOf('@') !== -1;
      });
    const roles = accessEntries.filter(function(entry) {
      return normalizeAccessEmail_(entry).indexOf('@') === -1;
    });
    const peopleByRole = getPeopleByAccessRole_();
    const people = [];

    roles.forEach(function(role) {
      const assignedPeople = peopleByRole[normalizeAccessText_(role)] || [];
      assignedPeople.forEach(function(person) {
        people.push(person);
      });
    });

    const authorizedEmails = getEmailsForPeople_(people);
    directEmails.forEach(function(email) {
      authorizedEmails[email] = true;
    });

    const allowed = Boolean(authorizedEmails[userEmail]);
    return {
      allowed: allowed,
      email: userEmail,
      accessEntries: accessEntries,
      roles: roles,
      directEmails: directEmails,
      people: people,
      message: allowed ? 'Acces autoritzat.' : 'No tens permisos per accedir a aquesta aplicacio.'
    };
  } catch (error) {
    return {
      allowed: false,
      email: normalizeAccessEmail_(Session.getActiveUser().getEmail()),
      message: error && error.message ? error.message : String(error)
    };
  }
}

function getAccessGrantedEntries_() {
  return splitAccessCommaList_(
    PropertiesService.getScriptProperties().getProperty(ACCESS_CONFIG_.accessGrantedPropertyName)
  );
}

function getPeopleByAccessRole_() {
  const sheet = getWorkloadCarrecsSheet_();
  const lastRow = sheet.getLastRow();
  const peopleByRole = {};

  if (lastRow < 2) return peopleByRole;

  const values = sheet.getRange(2, 1, lastRow - 1, CARRECS_COLUMNS_.asignado).getValues();
  values.forEach(function(row) {
    const roleName = toAccessString_(row[CARRECS_COLUMNS_.carrec - 1]);
    if (!roleName) return;

    peopleByRole[normalizeAccessText_(roleName)] = splitAccessCommaList_(
      row[CARRECS_COLUMNS_.asignado - 1]
    );
  });

  return peopleByRole;
}

function getEmailsForPeople_(people) {
  const emails = {};
  if (!people.length) return emails;

  const sheet = getWorkloadProfessorsSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return emails;

  const peopleSet = {};
  people.forEach(function(person) {
    peopleSet[normalizeAccessText_(person)] = true;
  });

  const values = sheet.getRange(2, 1, lastRow - 1, WORKLOAD_PROFESSORS_COLUMNS_.teacherKey).getValues();
  values.forEach(function(row) {
    const teacherKey = normalizeAccessText_(row[WORKLOAD_PROFESSORS_COLUMNS_.teacherKey - 1]);
    if (!peopleSet[teacherKey]) return;

    const email = normalizeAccessEmail_(row[WORKLOAD_PROFESSORS_COLUMNS_.correuInstit - 1]);
    if (email) emails[email] = true;
  });

  people.forEach(function(person) {
    const directEmail = normalizeAccessEmail_(person);
    if (directEmail.indexOf('@') !== -1) emails[directEmail] = true;
  });

  return emails;
}

function createAccessDeniedOutput_(access) {
  const email = access && access.email ? access.email : 'usuari no identificat';
  const message = access && access.message ? access.message : 'No tens permisos per accedir a aquesta aplicacio.';

  return HtmlService
    .createHtmlOutput(
      '<!doctype html>' +
      '<html lang="ca">' +
      '<head>' +
      '<base target="_top">' +
      '<meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width, initial-scale=1">' +
      '<title>Acces no autoritzat</title>' +
      '<style>' +
      'body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:Arial,sans-serif;background:#f5f7fb;color:#17202a;}' +
      'main{width:min(520px,calc(100vw - 32px));border:1px solid #d8dee9;background:#fff;padding:28px;box-shadow:0 18px 45px rgba(20,31,47,.12);}' +
      'h1{margin:0 0 12px;font-size:24px;}p{margin:8px 0;line-height:1.5}.email{font-family:monospace;color:#465466;}' +
      '</style>' +
      '</head>' +
      '<body><main>' +
      '<h1>Acces no autoritzat</h1>' +
      '<p>' + escapeAccessHtml_(message) + '</p>' +
      '<p class="email">' + escapeAccessHtml_(email) + '</p>' +
      '</main></body>' +
      '</html>'
    )
    .setTitle('Acces no autoritzat')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getWorkloadSpreadsheet_() {
  return openLogicalTableSpreadsheet_(ACCESS_CONFIG_.workloadRegistryName);
}

function getWorkloadProfessorsSheet_() {
  const sheet = getWorkloadSpreadsheet_().getSheetByName(ACCESS_CONFIG_.workloadProfessorsSheetName);
  if (!sheet) {
    throw new Error('No s ha trobat el full "' + ACCESS_CONFIG_.workloadProfessorsSheetName + '" a Carrega lectiva.');
  }
  return sheet;
}

function getWorkloadCarrecsSheet_() {
  const sheet = getWorkloadSpreadsheet_().getSheetByName(ACCESS_CONFIG_.workloadCarrecsSheetName);
  if (!sheet) {
    throw new Error('No s ha trobat el full "' + ACCESS_CONFIG_.workloadCarrecsSheetName + '" a Carrega lectiva.');
  }
  return sheet;
}

function grantRequiredPermissions() {
  const properties = PropertiesService.getScriptProperties();
  properties.getProperty(ACCESS_CONFIG_.registryPropertyName);
  properties.getProperty(ACCESS_CONFIG_.accessGrantedPropertyName);
  Session.getActiveUser().getEmail();
  getWorkloadCarrecsSheet_().getRange(1, 1).getValue();
  getWorkloadProfessorsSheet_().getRange(1, 1).getValue();

  return {
    ok: true,
    message: 'Permisos concedits correctament.'
  };
}

function toAccessString_(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function normalizeAccessText_(value) {
  return toAccessString_(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('ca');
}

function normalizeAccessEmail_(value) {
  return toAccessString_(value).toLocaleLowerCase('ca');
}

function splitAccessCommaList_(value) {
  return toAccessString_(value)
    .split(',')
    .map(function(item) {
      return toAccessString_(item);
    })
    .filter(Boolean);
}

function escapeAccessHtml_(value) {
  return toAccessString_(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
