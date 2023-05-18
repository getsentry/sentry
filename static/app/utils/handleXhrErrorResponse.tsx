import * as Sentry from '@sentry/react';

import RequestError from 'sentry/utils/requestError/requestError';

export function handleXhrErrorResponse(message: string, err: RequestError): void {
  // Sudo errors are handled separately elsewhere
  // @ts-ignore Property 'code' does not exist on type 'string'
  if (!err || !err.responseJSON || err.responseJSON?.detail?.code === 'sudo-required') {
    return;
  }

  const {responseJSON} = err;

  Sentry.withScope(scope => {
    scope.setExtra('status', err.status);
    scope.setExtra('responseJSON', responseJSON);
    Sentry.captureException(new Error(message));
  });
}
