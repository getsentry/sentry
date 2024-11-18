import {getContextKeys} from 'sentry/components/events/contexts/utils';
import {t} from 'sentry/locale';
import type {KeyValueListData} from 'sentry/types/group';

// https://develop.sentry.dev/sdk/data-model/event-payloads/contexts/#culture-context
const enum CultureContextKeys {
  CALENDAR = 'calendar',
  DISPLAY_NAME = 'display_name',
  LOCALE = 'locale',
  IS_24_HOUR = 'is_24_hour_format',
  TIMEZONE = 'timezone',
}

export interface CultureContext {
  // Any custom keys users may set
  [key: string]: any;
  [CultureContextKeys.CALENDAR]?: string;
  [CultureContextKeys.DISPLAY_NAME]?: string;
  [CultureContextKeys.LOCALE]?: string;
  [CultureContextKeys.IS_24_HOUR]?: boolean;
  [CultureContextKeys.TIMEZONE]?: string;
}

export function getCultureContextData({
  data = {},
  meta,
}: {
  data: CultureContext;
  meta?: Record<keyof CultureContext, any>;
}): KeyValueListData {
  return getContextKeys({data}).map(ctxKey => {
    switch (ctxKey) {
      case CultureContextKeys.CALENDAR:
        return {
          key: ctxKey,
          subject: t('Calendar'),
          value: data[CultureContextKeys.CALENDAR],
        };
      case CultureContextKeys.DISPLAY_NAME:
        return {
          key: ctxKey,
          subject: t('Display Name'),
          value: data[CultureContextKeys.DISPLAY_NAME],
        };
      case CultureContextKeys.LOCALE:
        return {
          key: ctxKey,
          subject: t('Locale'),
          value: data[CultureContextKeys.LOCALE],
        };
      case CultureContextKeys.IS_24_HOUR:
        return {
          key: ctxKey,
          subject: t('Uses 24h Format'),
          value: data[CultureContextKeys.IS_24_HOUR],
        };
      case CultureContextKeys.TIMEZONE:
        return {
          key: ctxKey,
          subject: t('Timezone'),
          value: data[CultureContextKeys.TIMEZONE],
        };
      default:
        return {
          key: ctxKey,
          subject: ctxKey,
          value: data[ctxKey],
          meta: meta?.[ctxKey]?.[''],
        };
    }
  });
}
