import * as Sentry from '@sentry/react';

import RequestError from 'sentry/utils/requestError/requestError';

export function handleXhrErrorResponse(message: string, err: RequestError): void {
  if (!err) {
    return;
  }
  if (!err.responseJSON) {
    return;
  }

  const {responseJSON} = err;

  // If this is a string then just capture it as error
  if (typeof responseJSON.detail === 'string') {
    Sentry.withScope(scope => {
      scope.setExtra('status', err.status);
      scope.setExtra('detail', responseJSON.detail);
      Sentry.captureException(new Error(message));
    });
    return;
  }

  // Ignore sudo-required errors
  if (responseJSON.detail && responseJSON.detail.code === 'sudo-required') {
    return;
  }

  if (responseJSON.detail && typeof responseJSON.detail.message === 'string') {
    Sentry.withScope(scope => {
      scope.setExtra('status', err.status);
      scope.setExtra('detail', responseJSON.detail);
      scope.setExtra('code', responseJSON.detail.code);
      Sentry.captureException(new Error(message));
    });
    return;
  }
}
