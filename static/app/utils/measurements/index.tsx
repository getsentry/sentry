import {getDuration} from 'sentry/utils/formatters';
import {Vital} from 'sentry/utils/performance/vitals/types';

export function formattedValue(record: Vital | undefined, value: number): string {
  if (record && record.type === 'duration') {
    return getDuration(value / 1000, 3);
  }
  if (record && record.type === 'integer') {
    return value.toFixed(0);
  }

  return value.toFixed(3);
}
