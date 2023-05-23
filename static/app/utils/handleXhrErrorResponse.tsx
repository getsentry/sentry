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

    Sentry.captureException(
      // We need to typecheck here even though `err` is typed in the function
      // signature because TS doesn't type thrown or rejected errors
      err instanceof Error ? new Error(message, {cause: err}) : new Error(message)
    );
  });
}
