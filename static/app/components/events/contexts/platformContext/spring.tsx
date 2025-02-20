import {getContextKeys} from 'sentry/components/events/contexts/utils';
import {t} from 'sentry/locale';
import type {KeyValueListData} from 'sentry/types/group';

enum SpringContextKeys {
  ACTIVE_PROFILES = 'active_profiles',
}

export interface SpringContext {
  // Any custom keys users may set
  [key: string]: any;
  [SpringContextKeys.ACTIVE_PROFILES]?: string[];
}

export function getSpringContextData({
  data,
  meta,
}: {
  data: SpringContext;
  meta?: Record<keyof SpringContext, any>;
}): KeyValueListData {
  return getContextKeys({data}).map(ctxKey => {
    switch (ctxKey) {
      case SpringContextKeys.ACTIVE_PROFILES:
        return {
          key: ctxKey,
          subject: t('Active Profiles'),
          value: data.active_profiles,
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
