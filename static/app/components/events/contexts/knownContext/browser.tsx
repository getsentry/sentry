import {getContextKeys} from 'sentry/components/events/contexts/utils';
import {t} from 'sentry/locale';
import type {KeyValueListData} from 'sentry/types/group';

export enum BrowserContextKeys {
  NAME = 'name',
  VERSION = 'version',
}

export interface BrowserContext {
  // Any custom keys users may set
  [key: string]: any;
  [BrowserContextKeys.NAME]?: string;
  [BrowserContextKeys.VERSION]?: string;
}

export function getBrowserContextData({
  data,
  meta,
}: {
  data: BrowserContext;
  meta?: Record<keyof BrowserContext, any>;
}): KeyValueListData {
  return getContextKeys({data}).map(ctxKey => {
    switch (ctxKey) {
      case BrowserContextKeys.NAME:
        return {
          key: ctxKey,
          subject: t('Name'),
          value: data.name,
        };
      case BrowserContextKeys.VERSION:
        return {
          key: ctxKey,
          subject: t('Version'),
          value: `${data.version}`,
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
