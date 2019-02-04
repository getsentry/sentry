import * as Sentry from '@sentry/browser';

export function logException(ex, context) {
  Sentry.withScope(scope => {
    scope.setExtra('context', context);
    Sentry.captureException(ex);
  });
  /*eslint no-console:0*/
  window.console && console.error && console.error(ex);
}

export function logAjaxError(error, context) {
  const errorString = error.responseJSON
    ? error.responseJSON.detail || JSON.stringify(error.responseJSON, null, 2)
    : error.responseText ? error.responseText.substr(0, 255) : '<unknown response>'; // occassionally responseText is undefined

  const message = `HTTP ${error.status}: ${errorString}`;
  Sentry.withScope(scope => {
    scope.setExtra('context', context);
    Sentry.captureMessage(message);
  });
  /*eslint no-console:0*/
  window.console && console.error && console.error(message);
}
