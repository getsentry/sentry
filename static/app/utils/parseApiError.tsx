import type {ResponseMeta} from 'sentry/types/api';

import type {RequestError} from './requestError/requestError';

export function parseApiError(resp: ResponseMeta | RequestError): string {
  const {detail} = resp?.responseJSON || {};

  // return immediately if string
  if (typeof detail === 'string') {
    return detail;
  }

  if (detail?.message) {
    return detail.message;
  }

  return 'Unknown API Error';
}
