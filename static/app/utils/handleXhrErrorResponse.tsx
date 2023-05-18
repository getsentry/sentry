import * as Sentry from '@sentry/react';

import RequestError from 'sentry/utils/requestError/requestError';

export function handleXhrErrorResponse(message: string, err: RequestError): void {
  // Sudo errors are handled separately elsewhere
  // @ts-ignore Property 'code' does not exist on type 'string'
  if (!err || !err.responseJSON || err.responseJSON?.detail?.code === 'sudo-required') {
    return;
  }

  const {responseJSON, status} = err;

  Sentry.withScope(scope => {
    scope.setExtras({
      status,
      responseJSON,
    });

    Sentry.captureException(new Error(message));
  });
}
