import * as Sentry from '@sentry/react';

export default function handleXhrErrorResponse(message: string) {
  return (resp: JQueryXHR) => {
    if (!resp) {
      return;
    }
    if (!resp.responseJSON) {
      return;
    }

    const {responseJSON} = resp;

    // If this is a string then just capture it as error
    if (typeof responseJSON.detail === 'string') {
      Sentry.withScope(scope => {
        scope.setExtra('status', resp.status);
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
        scope.setExtra('status', resp.status);
        scope.setExtra('detail', responseJSON.detail);
        scope.setExtra('code', responseJSON.detail.code);
        Sentry.captureException(new Error(message));
      });
      return;
    }
  };
}
