import type {ResponseMeta} from 'sentry/api';
import type RequestError from 'sentry/utils/requestError/requestError';

export default function parseApiError(resp: ResponseMeta | RequestError): string {
  const {detail} = resp?.responseJSON || ({} as Record<PropertyKey, unknown>);

  // return immediately if string
  if (typeof detail === 'string') {
    return detail;
  }

  if (detail?.message) {
    return detail.message;
  }

  return 'Unknown API Error';
}
