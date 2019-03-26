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
  // Promises will reject with an error instead of response
  const resp = error instanceof Error ? error.resp : error;
  const errorString = resp.responseJSON
    ? resp.responseJSON.detail || JSON.stringify(resp.responseJSON, null, 2)
    : resp.responseText ? resp.responseText.substr(0, 255) : '<unknown response>'; // occassionally responseText is undefined

  const message = `HTTP ${resp.status}: ${errorString}`;
  Sentry.withScope(scope => {
    scope.setExtra('context', context);
    Sentry.captureMessage(message);
  });
  /*eslint no-console:0*/
  window.console && console.error && console.error(message);
}
