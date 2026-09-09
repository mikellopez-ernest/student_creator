function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Student Creator')
    .addItem('Check configuration', 'checkConfiguration')
    .addToUi();
}

function checkConfiguration() {
  const properties = PropertiesService.getScriptProperties();
  const required = [
    'db',
    'dinantia_api_user',
    'dinantia_api_secret'
  ];

  const missing = required.filter(function(name) {
    return !String(properties.getProperty(name) || '').trim();
  });

  if (missing.length) {
    throw new Error('Missing script properties: ' + missing.join(', '));
  }

  SpreadsheetApp.getUi().alert('Configuration looks complete.');
}
