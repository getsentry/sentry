import * as Sentry from '@sentry/react';

import type RequestError from 'sentry/utils/requestError/requestError';

export function handleXhrErrorResponse(message: string, err: RequestError): void {
  // Sudo errors are handled separately elsewhere
  // @ts-expect-error TS(2339): Property 'code' does not exist on type 'string | {... Remove this comment to see the full error message
  if (!err || err.responseJSON?.detail?.code === 'sudo-required') {
    return;
  }

  const {responseJSON, status, message: causeMessage} = err;

  Sentry.withScope(scope => {
    // Turn `GET /dogs/are/great 500` into just `GET /dogs/are/great`
    const endpoint = causeMessage?.replace(new RegExp(` ${status}$`), '');

    scope.setTags({
      responseStatus: status,
      endpoint,
    });

    // TODO: If we discover that undefind response bodies don't break anything,
    // we can revert to bailing when `responseJSON` is falsy and always calling `setExtras`
    if (err.name !== 'UndefinedResponseBodyError') {
      scope.setExtras({
        status,
        responseJSON,
      });
    }

    Sentry.captureException(
      // We need to typecheck here even though `err` is typed in the function
      // signature because TS doesn't type thrown or rejected errors
      err instanceof Error ? new Error(message, {cause: err}) : new Error(message)
    );
  });
}
