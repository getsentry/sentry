import {Tag, type TagProps} from '@sentry/scraps/badge';

import {t} from 'sentry/locale';

const NO_RESPONSE_STATUS_LABELS: Record<number, string> = {
  0: t('timeout'),
  [-1]: t('connection error'),
};

export function ResponseCode({code}: {code: number}) {
  let variant: TagProps['variant'] = 'danger';
  if (code <= 399 && code >= 300) {
    variant = 'warning';
  } else if (code <= 299 && code >= 100) {
    variant = 'success';
  }

  return <Tag variant={variant}>{NO_RESPONSE_STATUS_LABELS[code] ?? code}</Tag>;
}
