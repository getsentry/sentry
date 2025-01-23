import {getContextKeys} from 'sentry/components/events/contexts/utils';
import {t} from 'sentry/locale';
import {type MemoryInfoContext, MemoryInfoContextKey} from 'sentry/types/event';
import type {KeyValueListData} from 'sentry/types/group';
import {formatBytesBase2} from 'sentry/utils/bytes/formatBytesBase2';

function formatMemory(memoryInBytes: number) {
  if (!Number.isInteger(memoryInBytes) || memoryInBytes <= 0) {
    return null;
  }
  return formatBytesBase2(memoryInBytes);
}

export function getMemoryInfoContext({
  data,
  meta,
}: {
  data: MemoryInfoContext;
  meta?: Record<keyof MemoryInfoContext, any>;
}): KeyValueListData {
  return getContextKeys({data}).map(ctxKey => {
    switch (ctxKey) {
      case MemoryInfoContextKey.ALLOCATED_BYTES:
        return {
          key: ctxKey,
          subject: t('Allocated Bytes'),
          value: data.allocated_bytes ? formatMemory(data.allocated_bytes) : undefined,
        };
      case MemoryInfoContextKey.FRAGMENTED_BYTES:
        return {
          key: ctxKey,
          subject: t('Fragmented Bytes'),
          value: data.fragmented_bytes ? formatMemory(data.fragmented_bytes) : undefined,
        };
      case MemoryInfoContextKey.HEAP_SIZE_BYTES:
        return {
          key: ctxKey,
          subject: t('Heap Size Bytes'),
          value: data.heap_size_bytes ? formatMemory(data.heap_size_bytes) : undefined,
        };
      case MemoryInfoContextKey.HIGH_MEMORY_LOAD_THRESHOLD_BYTES:
        return {
          key: ctxKey,
          subject: t('High Memory Load Threshold Bytes'),
          value: data.high_memory_load_threshold_bytes
            ? formatMemory(data.high_memory_load_threshold_bytes)
            : undefined,
        };
      case MemoryInfoContextKey.TOTAL_AVAILABLE_MEMORY_BYTES:
        return {
          key: ctxKey,
          subject: t('Total Available Memory Bytes'),
          value: data.total_available_memory_bytes
            ? formatMemory(data.total_available_memory_bytes)
            : undefined,
        };
      case MemoryInfoContextKey.MEMORY_LOAD_BYTES:
        return {
          key: ctxKey,
          subject: t('Memory Load Bytes'),
          value: data.memory_load_bytes
            ? formatMemory(data.memory_load_bytes)
            : undefined,
        };
      case MemoryInfoContextKey.TOTAL_COMMITTED_BYTES:
        return {
          key: ctxKey,
          subject: t('Total Committed Bytes'),
          value: data.total_committed_bytes
            ? formatMemory(data.total_committed_bytes)
            : undefined,
        };
      case MemoryInfoContextKey.PROMOTED_BYTES:
        return {
          key: ctxKey,
          subject: t('Promoted Bytes'),
          value: data.promoted_bytes ? formatMemory(data.promoted_bytes) : undefined,
        };
      case MemoryInfoContextKey.PINNED_OBJECTS_COUNT:
        return {
          key: ctxKey,
          subject: t('Pinned Objects Count'),
          value: data.pinned_objects_count,
        };
      case MemoryInfoContextKey.PAUSE_TIME_PERCENTAGE:
        return {
          key: ctxKey,
          subject: t('Pause Time Percentage'),
          value: data.pause_time_percentage,
        };
      case MemoryInfoContextKey.INDEX:
        return {
          key: ctxKey,
          subject: t('Index'),
          value: data.index,
        };
      case MemoryInfoContextKey.FINALIZATION_PENDING_COUNT:
        return {
          key: ctxKey,
          subject: t('Finalization Pending Count'),
          value: data.finalization_pending_count,
        };
      case MemoryInfoContextKey.COMPACTED:
        return {
          key: ctxKey,
          subject: t('Compacted'),
          value: data.compacted,
        };
      case MemoryInfoContextKey.CONCURRENT:
        return {
          key: ctxKey,
          subject: t('Concurrent'),
          value: data.concurrent,
        };
      case MemoryInfoContextKey.PAUSE_DURATIONS:
        return {
          key: ctxKey,
          subject: t('Pause Durations'),
          value: data.pause_durations,
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
