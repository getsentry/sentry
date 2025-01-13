import {formatBytesBase2} from 'sentry/utils/bytes/formatBytesBase2';
import {formatBytesBase10} from 'sentry/utils/bytes/formatBytesBase10';
import {ABYTE_UNITS, SIZE_UNITS} from 'sentry/utils/discover/fieldRenderers';
import {DurationUnit, type RateUnit} from 'sentry/utils/discover/fields';
import {formatAbbreviatedNumber, formatRate} from 'sentry/utils/formatters';
import {formatPercentage} from 'sentry/utils/number/formatPercentage';
import {convertDuration} from 'sentry/utils/unitConversion/convertDuration';

import {isADurationUnit} from '../common/typePredicates';

import {formatYAxisDuration} from './formatYAxisDuration';

export function formatYAxisValue(value: number, type: string, unit?: string): string {
  if (value === 0) {
    return '0';
  }

  switch (type) {
    case 'integer':
      return formatAbbreviatedNumber(value);
    case 'number':
      return value.toLocaleString();
    case 'percentage':
      return formatPercentage(value, 3);
    case 'duration':
      const inputUnit = isADurationUnit(unit) ? unit : DurationUnit.MILLISECOND;
      const durationInMilliseconds = convertDuration(
        value,
        inputUnit,
        DurationUnit.MILLISECOND
      );
      return formatYAxisDuration(durationInMilliseconds);
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
