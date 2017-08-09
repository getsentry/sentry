import Raven from 'raven-js';

export function logException(ex, context) {
  Raven.captureException(ex, {
    extra: context,
  });
  /*eslint no-console:0*/
  window.console && console.error && console.error(ex);
}

export function logAjaxError(error, context) {
  let errorString = error.responseJSON
    ? error.responseJSON.detail || JSON.stringify(error.responseJSON, null, 2)
    : error.responseText ? error.responseText.substr(0, 255) : '<unknown response>'; // occassionally responseText is undefined

  let message = `HTTP ${error.status}: ${errorString}`;
  Raven.captureMessage(message, {
    extra: context,
  });
  /*eslint no-console:0*/
  window.console && console.error && console.error(message);
}
