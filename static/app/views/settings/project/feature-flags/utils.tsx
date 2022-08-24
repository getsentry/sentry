import {t} from 'sentry/locale';

export function getCustomTagLabel(tagKey: string) {
  return `${tagKey} - ${t('Custom')}`;
}
