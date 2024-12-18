import {getContextKeys} from 'sentry/components/events/contexts/utils';
import type {KeyValueListData} from 'sentry/types/group';

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
