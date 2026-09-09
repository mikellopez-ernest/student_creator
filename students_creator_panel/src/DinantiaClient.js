function getDinantiaConfig_() {
  const properties = PropertiesService.getScriptProperties();
  const user = cleanText_(properties.getProperty('dinantia_api_user'));
  const secret = cleanText_(properties.getProperty('dinantia_api_secret'));
  const baseUrl = cleanText_(properties.getProperty('dinantia_api_base_url')) || CONFIG_.dinantiaDefaultBaseUrl;

  if (!user) throw new Error('Missing script property "dinantia_api_user".');
  if (!secret) throw new Error('Missing script property "dinantia_api_secret".');

  return {
    user: user,
    secret: secret,
    baseUrl: baseUrl.replace(/\/$/, '')
  };
}

function buildDinantiaHeaders_() {
  const config = getDinantiaConfig_();
  const token = Utilities.base64Encode(config.user + ':' + config.secret);

  return {
    Accept: 'application/vnd.api+json',
    'Content-Type': 'application/vnd.api+json',
    Authorization: 'Basic ' + token
  };
}

function dinantiaFetch_(path, options) {
  const config = getDinantiaConfig_();
  const requestOptions = options || {};
  logPanelStep_('dinantiaFetch:start', {
    method: requestOptions.method || 'get',
    path: sanitizeDinantiaPathForLog_(path)
  });

  const response = UrlFetchApp.fetch(config.baseUrl + path, {
    method: requestOptions.method || 'get',
    headers: buildDinantiaHeaders_(),
    payload: requestOptions.payload ? JSON.stringify(requestOptions.payload) : undefined,
    contentType: 'application/vnd.api+json',
    muteHttpExceptions: true
  });

  const code = response.getResponseCode();
  const text = response.getContentText();
  const body = parseDinantiaResponse_(text, code);

  logPanelStep_('dinantiaFetch:response', {
    method: requestOptions.method || 'get',
    path: sanitizeDinantiaPathForLog_(path),
    status: code,
    success: body.success
  });

  if (code < 200 || code >= 300 || body.success === false) {
    throw new Error('Dinantia API error ' + code + ': ' + formatDinantiaError_(body, text));
  }

  return body;
}

function parseDinantiaResponse_(text, code) {
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error('Dinantia API error ' + code + ': resposta no JSON.');
  }
}

function formatDinantiaError_(body, fallbackText) {
  if (body && Array.isArray(body.errors) && body.errors.length) {
    return body.errors.map(function(error) {
      return [
        error.field || error.code || 'Dinantia',
        error.message || error.detail || 'error'
      ].join(': ');
    }).join('; ');
  }

  return body && (body.message || body.error) || fallbackText || 'error desconegut';
}

function sanitizeDinantiaPathForLog_(path) {
  return String(path || '').replace(/email=[^&]+/g, 'email=REDACTED');
}

function dinantiaListGroups_() {
  const groups = [];
  let page = 1;
  let hasNextPage = true;

  while (hasNextPage) {
    const body = dinantiaFetch_('/v1/groups/index?limit=100&page=' + page);
    const data = Array.isArray(body.data) ? body.data : [];

    data.forEach(function(group) {
      groups.push({
        id: cleanText_(group.id),
        name: cleanText_(group.name),
        tag: cleanText_(group.tag),
        parent: cleanText_(group.parent),
        types: group.types || []
      });
    });

    hasNextPage = Boolean(body.pagination && body.pagination.has_next_page);
    page += 1;
  }

  return groups.sort(function(a, b) {
    return (a.tag || a.name || a.id).localeCompare(b.tag || b.name || b.id, 'ca');
  });
}

function dinantiaAccountExists_(id) {
  if (!id) return false;

  try {
    dinantiaFetch_('/v1/accounts/view/' + encodeURIComponent(id));
    return true;
  } catch (error) {
    if (String(error.message || '').indexOf('404') !== -1) return false;
    throw error;
  }
}

function dinantiaEmailExists_(email) {
  const body = dinantiaFetch_('/v1/accounts/index?email=' + encodeURIComponent(email) + '&limit=5');
  return Array.isArray(body.data) && body.data.length > 0;
}

function createDinantiaStudent_(student, contacts, groupIds, institutionalEmail) {
  const groups = {
    member: groupIds
  };

  const payload = {
    id: student.id,
    name: buildFullName_(student),
    email: institutionalEmail,
    gender: 'other',
    language: 'ca_ES',
    roles: ['Student'],
    groups: groups,
    parents: contacts.map(function(contact) {
      return {
        name: contact.fullName,
        email: contact.email,
        phone: contact.phone,
        role: 'Parent',
        gender: getDinantiaParentGender_(contact.relation)
      };
    }),
    fields: []
  };

  logPanelStep_('createDinantiaStudent:payloadReady', {
    studentId: student.id,
    hasStudentEmail: Boolean(payload.email),
    groupScopes: Object.keys(groups),
    groupIds: groupIds,
    parentCount: payload.parents.length,
    parentFields: payload.parents.map(function(parent) {
      return Object.keys(parent).sort();
    })
  });

  return dinantiaFetch_('/v1/accounts/update', {
    method: 'post',
    payload: payload
  });
}

function getDinantiaParentGender_(relation) {
  const value = cleanText_(relation).toLowerCase();
  if (value === 'mare') return 'female';
  if (value === 'pare') return 'male';
  return 'other';
}
