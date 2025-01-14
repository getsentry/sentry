import {getContextKeys} from 'sentry/components/events/contexts/utils';
import {t} from 'sentry/locale';
import {type ThreadPoolInfoContext, ThreadPoolInfoContextKey} from 'sentry/types/event';
import type {KeyValueListData} from 'sentry/types/group';

export function getThreadPoolInfoContext({
  data,
  meta,
}: {
  data: ThreadPoolInfoContext;
  meta?: Record<keyof ThreadPoolInfoContext, any>;
}): KeyValueListData {
  return getContextKeys({data}).map(ctxKey => {
    switch (ctxKey) {
      case ThreadPoolInfoContextKey.AVAILABLE_COMPLETION_PORT_THREADS:
        return {
          key: ctxKey,
          subject: t('Available Completion Port Threads'),
          value: data.available_completion_port_threads,
        };
      case ThreadPoolInfoContextKey.AVAILABLE_WORKER_THREADS:
        return {
          key: ctxKey,
          subject: t('Available Worker Threads'),
          value: data.available_worker_threads,
        };
      case ThreadPoolInfoContextKey.MAX_COMPLETION_PORT_THREADS:
        return {
          key: ctxKey,
          subject: t('Max Completion Port Threads'),
          value: data.max_completion_port_threads,
        };
      case ThreadPoolInfoContextKey.MAX_WORKER_THREADS:
        return {
          key: ctxKey,
          subject: t('Max Worker Threads'),
          value: data.max_worker_threads,
        };
      case ThreadPoolInfoContextKey.MIN_COMPLETION_PORT_THREADS:
        return {
          key: ctxKey,
          subject: t('Min Completion Port Threads'),
          value: data.min_completion_port_threads,
        };
      case ThreadPoolInfoContextKey.MIN_WORKER_THREADS:
        return {
          key: ctxKey,
          subject: t('Min Worker Threads'),
          value: data.min_worker_threads,
        };
      default:
        return {
          key: ctxKey,
          subject: ctxKey,
          // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
          value: data[ctxKey],
          // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
          meta: meta?.[ctxKey]?.[''],
        };
    }
  });
}
