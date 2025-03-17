import {getContextKeys} from 'sentry/components/events/contexts/utils';
import {t} from 'sentry/locale';
import type {KeyValueListData} from 'sentry/types/group';

enum ReactContextKeys {
  VERSION = 'version',
}

export interface ReactContext {
  // Any custom keys users may set
  [key: string]: any;
  [ReactContextKeys.VERSION]: string;
}

export function getReactContextData({data}: {data: ReactContext}): KeyValueListData {
  return getContextKeys({data}).map(ctxKey => {
    switch (ctxKey) {
      case ReactContextKeys.VERSION:
        return {
          key: ctxKey,
          subject: t('Version'),
          value: data.version,
        };
      default:
        return {
          key: ctxKey,
          subject: ctxKey,
          value: data[ctxKey],
        };
    }
  });
}
