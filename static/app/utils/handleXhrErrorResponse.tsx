import * as Sentry from '@sentry/react';

import RequestError from 'sentry/utils/requestError/requestError';

export function handleXhrErrorResponse(message: string, err: RequestError): void {
  // Sudo errors are handled separately elsewhere
  // @ts-ignore Property 'code' does not exist on type 'string'
  if (!err || !err.responseJSON || err.responseJSON?.detail?.code === 'sudo-required') {
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

  if (responseJSON.detail && typeof responseJSON.detail.message === 'string') {
    Sentry.withScope(scope => {
      scope.setExtra('status', err.status);
      scope.setExtra('detail', responseJSON.detail);
      // @ts-ignore Property 'code' does not exist on type 'string' (god knows why
      // it's not mad at the other places in this function we do this, but ¯\_(ツ)_/¯)
      scope.setExtra('code', responseJSON.detail?.code);
      Sentry.captureException(new Error(message));
    });
    return;
  }
}
