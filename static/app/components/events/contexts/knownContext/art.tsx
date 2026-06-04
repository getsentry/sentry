import {getContextKeys} from 'sentry/components/events/contexts/utils';
import {t} from 'sentry/locale';
import type {KeyValueListData} from 'sentry/types/group';
import {formatBytesBase2} from 'sentry/utils/bytes/formatBytesBase2';
import {getDuration} from 'sentry/utils/duration/getDuration';

enum ARTContextKeys {
  GC_BLOCKING_COUNT = 'gc.blocking_count',
  GC_PRE_OOME_COUNT = 'gc.pre_oome_count',
  GC_TOTAL_TIME = 'gc.total_time',
  GC_WAITING_TIME = 'gc.waiting_time',
  MEMORY_FREE = 'memory.free',
  MEMORY_FREE_UNTIL_GC = 'memory.free_until_gc',
  MEMORY_MAX = 'memory.max',
  MEMORY_TOTAL = 'memory.total',
}

export interface ARTContext {
  [key: string]: any;
  [ARTContextKeys.GC_BLOCKING_COUNT]?: number;
  [ARTContextKeys.GC_PRE_OOME_COUNT]?: number;
  [ARTContextKeys.GC_TOTAL_TIME]?: number;
  [ARTContextKeys.GC_WAITING_TIME]?: number;
  [ARTContextKeys.MEMORY_FREE]?: number;
  [ARTContextKeys.MEMORY_FREE_UNTIL_GC]?: number;
  [ARTContextKeys.MEMORY_MAX]?: number;
  [ARTContextKeys.MEMORY_TOTAL]?: number;
}

function formatMilliseconds(ms: number): string {
  return getDuration(ms / 1000, 2, true);
}

export function getARTContextData({
  data,
  meta,
}: {
  data: ARTContext;
  meta?: Record<keyof ARTContext, any>;
}): KeyValueListData {
  return getContextKeys({data}).map(ctxKey => {
    switch (ctxKey) {
      case ARTContextKeys.GC_BLOCKING_COUNT:
        return {
          key: ctxKey,
          subject: t('GC Blocking Count'),
          value: data[ARTContextKeys.GC_BLOCKING_COUNT],
        };
      case ARTContextKeys.GC_PRE_OOME_COUNT:
        return {
          key: ctxKey,
          subject: t('GC Pre-OOME Count'),
          value: data[ARTContextKeys.GC_PRE_OOME_COUNT],
        };
      case ARTContextKeys.GC_TOTAL_TIME:
        return {
          key: ctxKey,
          subject: t('GC Total Time'),
          value: data[ARTContextKeys.GC_TOTAL_TIME]
            ? formatMilliseconds(data[ARTContextKeys.GC_TOTAL_TIME])
            : data[ARTContextKeys.GC_TOTAL_TIME],
        };
      case ARTContextKeys.GC_WAITING_TIME:
        return {
          key: ctxKey,
          subject: t('GC Waiting Time'),
          value: data[ARTContextKeys.GC_WAITING_TIME]
            ? formatMilliseconds(data[ARTContextKeys.GC_WAITING_TIME])
            : data[ARTContextKeys.GC_WAITING_TIME],
        };
      case ARTContextKeys.MEMORY_FREE:
        return {
          key: ctxKey,
          subject: t('Memory Free'),
          value: data[ARTContextKeys.MEMORY_FREE]
            ? formatBytesBase2(data[ARTContextKeys.MEMORY_FREE])
            : data[ARTContextKeys.MEMORY_FREE],
        };
      case ARTContextKeys.MEMORY_FREE_UNTIL_GC:
        return {
          key: ctxKey,
          subject: t('Memory Free Until GC'),
          value: data[ARTContextKeys.MEMORY_FREE_UNTIL_GC]
            ? formatBytesBase2(data[ARTContextKeys.MEMORY_FREE_UNTIL_GC])
            : data[ARTContextKeys.MEMORY_FREE_UNTIL_GC],
        };
      case ARTContextKeys.MEMORY_MAX:
        return {
          key: ctxKey,
          subject: t('Memory Max'),
          value: data[ARTContextKeys.MEMORY_MAX]
            ? formatBytesBase2(data[ARTContextKeys.MEMORY_MAX])
            : data[ARTContextKeys.MEMORY_MAX],
        };
      case ARTContextKeys.MEMORY_TOTAL:
        return {
          key: ctxKey,
          subject: t('Memory Total'),
          value: data[ARTContextKeys.MEMORY_TOTAL]
            ? formatBytesBase2(data[ARTContextKeys.MEMORY_TOTAL])
            : data[ARTContextKeys.MEMORY_TOTAL],
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
