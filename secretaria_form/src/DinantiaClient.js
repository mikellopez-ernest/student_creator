function getDinantiaConfig_() {
  const properties = PropertiesService.getScriptProperties();
  const user = String(properties.getProperty('dinantia_api_user') || '').trim();
  const secret = String(properties.getProperty('dinantia_api_secret') || '').trim();

  if (!user) throw new Error('Missing script property "dinantia_api_user".');
  if (!secret) throw new Error('Missing script property "dinantia_api_secret".');

  return {
    user: user,
    secret: secret
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
