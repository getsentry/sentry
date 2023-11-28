import {ResponseMeta} from 'sentry/api';
import RequestError from 'sentry/utils/requestError/requestError';

export default function parseApiError(resp: ResponseMeta | RequestError): string {
  const {detail} = (resp && resp.responseJSON) || ({} as object);

  // return immediately if string
  if (typeof detail === 'string') {
    return detail;
  }

  if (detail && detail.message) {
    return detail.message;
  }

  return 'Unknown API Error';
}
