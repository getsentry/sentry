import {getContextKeys} from 'sentry/components/events/contexts/utils';
import {t} from 'sentry/locale';
import type {KeyValueListData} from 'sentry/types/group';

enum WERContextKeys {
  REPORT_ID = 'report_id',
}

export interface WERContext {
  // Any custom keys users may set
  [key: string]: any;
  [WERContextKeys.REPORT_ID]?: string;
}

export function getWERContextData({
  data,
  meta,
}: {
  data: WERContext;
  meta?: Record<keyof WERContext, any>;
}): KeyValueListData {
  return getContextKeys({data}).map(ctxKey => {
    switch (ctxKey) {
      case WERContextKeys.REPORT_ID:
        return {
          key: ctxKey,
          subject: t('Report ID'),
          value: data.report_id,
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
