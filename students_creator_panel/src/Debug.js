function logPanelStep_(stage, details) {
  const payload = details || {};
  console.log(JSON.stringify({
    app: 'students_creator_panel',
    stage: stage,
    timestamp: new Date().toISOString(),
    details: payload
  }));
}

function logPanelError_(stage, error, details) {
  const payload = details || {};
  console.error(JSON.stringify({
    app: 'students_creator_panel',
    stage: stage,
    timestamp: new Date().toISOString(),
    error: error && error.message ? error.message : String(error),
    stack: error && error.stack ? error.stack : '',
    details: payload
  }));
}
