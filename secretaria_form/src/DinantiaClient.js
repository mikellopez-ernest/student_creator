function getDinantiaConfig_() {
  const properties = PropertiesService.getScriptProperties();
  const user = String(properties.getProperty('dinantia_api_user') || '').trim();
  const secret = String(properties.getProperty('dinantia_api_secret') || '').trim();
  const baseUrl = String(properties.getProperty('dinantia_api_base_url') || '').trim() ||
    'https://app.dinantia.com/api/web';

  if (!user) throw new Error('Missing script property "dinantia_api_user".');
  if (!secret) throw new Error('Missing script property "dinantia_api_secret".');

  return {
    user: user,
    secret: secret,
    baseUrl: baseUrl.replace(/\/$/, '')
  };
}

function dinantiaFetch_(path, options) {
  const config = getDinantiaConfig_();
  const requestOptions = options || {};
  const method = requestOptions.method || 'get';
  let response;
  try {
    response = UrlFetchApp.fetch(config.baseUrl + path, {
      method: method,
      headers: buildDinantiaHeaders_(),
      payload: requestOptions.payload ? JSON.stringify(requestOptions.payload) : undefined,
      contentType: 'application/vnd.api+json',
      muteHttpExceptions: true
    });
  } catch (error) {
    const message = error && error.message ? error.message : String(error);
    if (message.indexOf('script.external_request') !== -1 ||
        message.indexOf('UrlFetchApp.fetch') !== -1) {
      throw new Error(
        'El compte que ha desplegat l aplicacio no ha autoritzat l acces extern a Dinantia. ' +
        'Cal obrir el projecte Apps Script amb aquest compte, executar grantRequiredPermissions ' +
        'i acceptar tots els permisos sol licitats.'
      );
    }
    throw error;
  }
  const status = response.getResponseCode();
  const text = response.getContentText();
  const body = parseDinantiaResponse_(text, status);

  console.log(JSON.stringify({
    event: 'dinantiaFetch',
    method: method,
    path: path,
    status: status,
    success: body.success
  }));

  if (status < 200 || status >= 300 || body.success === false) {
    throw new Error('Dinantia API error ' + status + ': ' + formatDinantiaError_(body, text));
  }

  return body;
}

function parseDinantiaResponse_(text, status) {
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error('Dinantia API error ' + status + ': resposta no JSON.');
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

function getDinantiaAccount_(studentId) {
  return dinantiaFetch_('/v1/accounts/view/' + encodeURIComponent(studentId));
}

function deleteDinantiaAccount_(studentId) {
  return dinantiaFetch_('/v1/accounts/delete/' + encodeURIComponent(studentId), {
    method: 'delete'
  });
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
