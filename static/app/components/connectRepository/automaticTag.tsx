import {Tag} from '@sentry/scraps/badge';

import {t} from 'sentry/locale';

export function AutomaticTag() {
  return <Tag variant="info">{t('Automatic')}</Tag>;
}
