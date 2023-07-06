import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';

export function formatError(error: any): string | null {
  if (!defined(error)) {
    return null;
  }

  const detail = error.responseJSON?.detail;
  if (typeof detail === 'string') {
    return detail;
  }

  const message = detail?.message;
  if (typeof message === 'string') {
    return message;
  }

  return t('An unknown error occurred.');
}
