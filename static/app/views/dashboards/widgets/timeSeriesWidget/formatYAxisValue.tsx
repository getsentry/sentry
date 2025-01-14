import {formatBytesBase2} from 'sentry/utils/bytes/formatBytesBase2';
import {formatBytesBase10} from 'sentry/utils/bytes/formatBytesBase10';
import {
  ABYTE_UNITS,
  DURATION_UNITS,
  SIZE_UNITS,
} from 'sentry/utils/discover/fieldRenderers';
import type {RateUnit} from 'sentry/utils/discover/fields';
import getDuration from 'sentry/utils/duration/getDuration';
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
      // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      return getDuration((value * (unit ? DURATION_UNITS[unit] : 1)) / 1000, 2, true);
    case 'size':
      // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
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
