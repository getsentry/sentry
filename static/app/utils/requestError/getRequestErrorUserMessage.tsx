import {t} from 'sentry/locale';

import {RequestError} from './requestError';

const DEFAULT_FALLBACK = t('Something went wrong. Please try again.');

/**
 * User-facing copy for failed API requests. Prefer server `detail` when present,
 * otherwise map common HTTP statuses to friendly text.
 */
export function getRequestErrorUserMessage(
  err: unknown,
  fallback: string = DEFAULT_FALLBACK
): string {
  if (!(err instanceof RequestError)) {
    if (err instanceof Error && err.message) {
      return err.message;
    }
    return fallback;
  }

  const detail = err.responseJSON?.detail;
  if (typeof detail === 'string' && detail.trim()) {
    return detail;
  }
  if (detail && typeof detail === 'object' && 'message' in detail) {
    const message = (detail as {message?: unknown}).message;
    if (typeof message === 'string' && message.trim()) {
      return message;
    }
  }

  switch (err.status) {
    case 429:
      return t(
        'API requests have been temporarily rate-limited. Please wait a moment and try again.'
      );
    case 401:
      return t('Authentication is required to load this data.');
    case 403:
      return t('You do not have permission to load this data.');
    case 404:
      return t('The requested data could not be found.');
    case 500:
      return t('The server encountered an error while processing this request.');
    case 502:
    case 503:
      return t(
        'The server is temporarily unavailable. Please try again in a few moments.'
      );
    case 504:
      return t('The request timed out. Please try again.');
    default:
      return fallback;
  }
}
