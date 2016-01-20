export function logException(ex, context) {
  Raven.captureException(ex, {
    extra: context
  });
  /*eslint no-console:0*/
  window.console && console.error && console.error(ex);
}

export function logAjaxError(error, context) {
  let message = `HTTP ${error.status}: ${error.responseJSON.detail || error.responseJSON.toString()}`;
  Raven.captureMessage(message, {
    extra: context
  });
  /*eslint no-console:0*/
  window.console && console.error && console.error(message);
}
