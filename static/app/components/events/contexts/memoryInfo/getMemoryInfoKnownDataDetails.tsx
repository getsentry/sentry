import {t} from 'sentry/locale';
import {Event, MemoryInfoContext, MemoryInfoContextKey} from 'sentry/types/event';

export const memoryInfoKnownDataValues = [...Object.values(MemoryInfoContextKey)];

type Output = {
  subject: string;
  value: React.ReactNode | null;
};

type Props = {
  data: MemoryInfoContext;
  event: Event;
  type: keyof typeof memoryInfoKnownDataValues;
};

export function getMemoryInfoKnownDataDetails({data, type}: Props): Output | undefined {
  switch (type) {
    case MemoryInfoContextKey.ALLOCATED_BYTES:
      return {
        subject: t('Allocated Bytes'),
        value: data.allocated_bytes,
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
    case MemoryInfoContextKey.FINALIZATION_PENDING_COUNT:
      return {
        subject: t('Finalization Pending Count'),
        value: data.finalization_pending_count,
      };
    case MemoryInfoContextKey.HIGH_MEMORY_LOAD_THRESHOLD_BYTES:
      return {
        subject: t('High Memory Load Threshold Bytes'),
        value: data.finalization_pending_count,
      };
    case MemoryInfoContextKey.PAUSE_DURATIONS:
      return {
        subject: t('Pause Durations'),
        value: data.pause_durations,
      };
    case MemoryInfoContextKey.TOTAL_AVAILABLE_MEMORY_BYTES:
      return {
        subject: t('Total Available Memory Bytes'),
        value: data.total_available_memory_bytes,
      };
    default:
      return undefined;
  }
}
