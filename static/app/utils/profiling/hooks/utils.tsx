import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';

import type {Sort} from './types';

export function formatSort<F extends string>(
  value: string | undefined,
  allowedKeys: readonly F[],
  fallback: Sort<F>
): Sort<F> {
  value = value || '';
  const order: Sort<F>['order'] = value[0] === '-' ? 'desc' : 'asc';
  const key = order === 'asc' ? value : value.substring(1);

  if (!allowedKeys.includes(key as F)) {
    return fallback;
  }

  return {key: key as F, order};
}

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
