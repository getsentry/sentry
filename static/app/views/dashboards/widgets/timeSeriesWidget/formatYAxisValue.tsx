import {formatBytesBase2} from 'sentry/utils/bytes/formatBytesBase2';
import {formatBytesBase10} from 'sentry/utils/bytes/formatBytesBase10';
import {
  ABYTE_UNITS,
  DURATION_UNITS,
  SIZE_UNITS,
} from 'sentry/utils/discover/fieldRenderers';
import type {RateUnit} from 'sentry/utils/discover/fields';
import {axisDuration} from 'sentry/utils/duration/axisDuration';
import {formatAbbreviatedNumber, formatRate} from 'sentry/utils/formatters';
import {formatPercentage} from 'sentry/utils/number/formatPercentage';

export function formatYAxisValue(value: number, type: string, unit?: string): string {
  switch (type) {
    case 'integer':
      return formatAbbreviatedNumber(value);
    case 'number':
      return value.toLocaleString();
    case 'percentage':
      return formatPercentage(value, 3);
    case 'duration':
      return axisDuration(value * (unit ? DURATION_UNITS[unit] : 1));
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
