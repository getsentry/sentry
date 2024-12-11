import {formatBytesBase2} from 'sentry/utils/bytes/formatBytesBase2';
import {formatBytesBase10} from 'sentry/utils/bytes/formatBytesBase10';
import {
  ABYTE_UNITS,
  DURATION_UNITS,
  SIZE_UNITS,
} from 'sentry/utils/discover/fieldRenderers';
import type {RateUnit} from 'sentry/utils/discover/fields';
import getDuration from 'sentry/utils/duration/getDuration';
import {formatRate} from 'sentry/utils/formatters';
import {formatPercentage} from 'sentry/utils/number/formatPercentage';

export function formatChartValue(value: number, type: string, unit?: string): string {
  switch (type) {
    case 'integer':
    case 'number':
      return value.toLocaleString();
    case 'percentage':
      return formatPercentage(value, 2);
    case 'duration':
      return getDuration((value * (unit ? DURATION_UNITS[unit] : 1)) / 1000, 2, true);
    case 'size':
      const bytes = value * SIZE_UNITS[unit ?? 'byte'];

      const formatter = ABYTE_UNITS.includes(unit ?? 'byte')
        ? formatBytesBase10
        : formatBytesBase2;

      return formatter(bytes);
    case 'rate':
      return formatRate(value, unit as RateUnit);
    default:
      return value.toString();
  }
}
