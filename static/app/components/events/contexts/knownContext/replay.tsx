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
    // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    value: data[ctxKey],
    // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    meta: meta?.[ctxKey]?.[''],
  }));
}
