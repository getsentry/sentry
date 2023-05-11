import {t} from 'sentry/locale';
import {Event, MemoryInfoContext, MemoryInfoContextKey} from 'sentry/types/event';

export const memoryInfoKnownDataValues = Object.values(MemoryInfoContextKey);

type Output = {
  subject: string;
  value: React.ReactNode | null;
};

type Props = {
  data: MemoryInfoContext;
  event: Event;
  type: (typeof memoryInfoKnownDataValues)[number];
};

export function getMemoryInfoKnownDataDetails({data, type}: Props): Output | undefined {
  switch (type) {
    case MemoryInfoContextKey.ALLOCATED_BYTES:
      return {
        subject: t('Allocated Bytes'),
        value: data.allocated_bytes,
      };
    case MemoryInfoContextKey.FRAGMENTED_BYTES:
      return {
        subject: t('Fragmented Bytes'),
        value: data.fragmented_bytes,
      };
    case MemoryInfoContextKey.HEAP_SIZE_BYTES:
      return {
        subject: t('Heap Size Bytes'),
        value: data.heap_size_bytes,
      };
    case MemoryInfoContextKey.HIGH_MEMORY_LOAD_THRESHOLD_BYTES:
      return {
        subject: t('High Memory Load Threshold Bytes'),
        value: data.high_memory_load_threshold_bytes,
      };
    case MemoryInfoContextKey.TOTAL_AVAILABLE_MEMORY_BYTES:
      return {
        subject: t('Total Available Memory Bytes'),
        value: data.total_available_memory_bytes,
      };
    case MemoryInfoContextKey.MEMORY_LOAD_BYTES:
      return {
        subject: t('Memory Load Bytes'),
        value: data.memory_load_bytes,
      };
    case MemoryInfoContextKey.TOTAL_COMMITTED_BYTES:
      return {
        subject: t('Total Committed Bytes'),
        value: data.total_committed_bytes,
      };
    case MemoryInfoContextKey.PROMOTED_BYTES:
      return {
        subject: t('Promoted Bytes'),
        value: data.promoted_bytes,
      };
    case MemoryInfoContextKey.PINNED_OBJECTS_COUNT:
      return {
        subject: t('Pinned Objects Count'),
        value: data.pinned_objects_count,
      };
    case MemoryInfoContextKey.PAUSE_TIME_PERCENTAGE:
      return {
        subject: t('Pause Time Percentage'),
        value: data.pause_time_percentage,
      };
    case MemoryInfoContextKey.INDEX:
      return {
        subject: t('Index'),
        value: data.index,
      };
    case MemoryInfoContextKey.FINALIZATION_PENDING_COUNT:
      return {
        subject: t('Finalization Pending Count'),
        value: data.finalization_pending_count,
      };
    case MemoryInfoContextKey.COMPACTED:
      return {
        subject: t('Compacted'),
        value: data.compacted,
      };
    case MemoryInfoContextKey.CONCURRENT:
      return {
        subject: t('Concurrent'),
        value: data.concurrent,
      };
    case MemoryInfoContextKey.PAUSE_DURATIONS:
      return {
        subject: t('Pause Durations'),
        value: data.pause_durations,
      };

    default:
      return undefined;
  }
}
