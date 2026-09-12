function requireAdmin_() {
  return assertUserAccess_().email;
}

function googleUserExists_(email) {
  try {
    AdminDirectory.Users.get(email);
    return true;
  } catch (error) {
    if (isNotFoundError_(error)) return false;
    throw error;
  }
}

function checkGoogleEmailAvailability(email) {
  requireAdmin_();

  const normalizedEmail = normalizeInstitutionalEmail_(email);
  return {
    email: normalizedEmail,
    available: !googleUserExists_(normalizedEmail)
  };
}

function createGoogleStudentUser_(student, institutionalEmail, contacts) {
  const normalizedEmail = normalizeInstitutionalEmail_(institutionalEmail);
  const familyName = [student.surname1, student.surname2].filter(Boolean).join(' ');
  const recoveryEmail = contacts.length ? contacts[0].email : '';

  const payload = {
    primaryEmail: normalizedEmail,
    name: {
      givenName: student.name,
      familyName: familyName
    },
    password: CONFIG_.initialStudentPassword,
    changePasswordAtNextLogin: true,
    orgUnitPath: CONFIG_.studentOrgUnitPath
  };

  if (recoveryEmail) {
    payload.recoveryEmail = recoveryEmail;
  }

  return AdminDirectory.Users.insert(payload);
}

function normalizeInstitutionalEmail_(email) {
  const value = cleanText_(email).toLowerCase();
  if (!value.endsWith('@' + CONFIG_.studentEmailDomain)) {
    throw new Error('El correu ha de ser @' + CONFIG_.studentEmailDomain + '.');
  }

  return value;
}

function generateSuggestedStudentEmail_(student) {
  const day = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'd');
  const localPart = normalizeEmailLocalPart_(student.name + student.surname1 + day);
  return localPart + '@' + CONFIG_.studentEmailDomain;
}

function isNotFoundError_(error) {
  const message = String(error && error.message || error);
  return message.indexOf('Resource Not Found') !== -1 ||
    message.indexOf('notFound') !== -1 ||
    message.indexOf('Not Found') !== -1 ||
    message.indexOf('404') !== -1;
}
