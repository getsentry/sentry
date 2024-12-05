import {getContextKeys} from 'sentry/components/events/contexts/utils';
import {type ReplayContext, ReplayContextKey} from 'sentry/types/event';
import type {KeyValueListData} from 'sentry/types/group';

export function getReplayContextData({
  data,
  meta,
}: {
  data: ReplayContext;
  meta?: Record<keyof ReplayContext, any>;
}): KeyValueListData {
  return getContextKeys({data, hiddenKeys: [ReplayContextKey.REPLAY_ID]}).map(ctxKey => ({
    key: ctxKey,
    subject: ctxKey,
    value: data[ctxKey],
    meta: meta?.[ctxKey]?.[''],
  }));
}
