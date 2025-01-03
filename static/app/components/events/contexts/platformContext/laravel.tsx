import type {KeyValueListData} from 'sentry/types/group';

import {getContextKeys} from 'sentry/components/events/contexts/utils';

export interface LaravelContext {
  // Any custom keys users may set
  [key: string]: any;
}

export function getLaravelContextData({data}: {data: LaravelContext}): KeyValueListData {
  return getContextKeys({data}).map(ctxKey => ({
    key: ctxKey,
    subject: ctxKey,
    value: data[ctxKey],
  }));
}
