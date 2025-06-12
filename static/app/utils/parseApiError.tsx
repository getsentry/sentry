import type {ResponseMeta} from 'sentry/api';

export default function parseApiError(resp: ResponseMeta): string {
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
