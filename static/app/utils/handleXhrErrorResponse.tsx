import * as Sentry from '@sentry/react';

import RequestError from './requestError/requestError';

export default function handleXhrErrorResponse(resp: RequestError) {
  if (!resp) {
    return;
  }
  if (!resp.responseJSON) {
    return;
  }

  const {responseJSON} = resp;

  // If this is a string then just capture it as error
  if (typeof responseJSON.detail !== 'string') {
    // Ignore sudo-required errors
    if (responseJSON.detail && responseJSON.detail.code === 'sudo-required') {
      return;
    }
  }

  Sentry.captureException(resp);
}
