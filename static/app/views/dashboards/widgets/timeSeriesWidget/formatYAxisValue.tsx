import {formatBytesBase2} from 'sentry/utils/bytes/formatBytesBase2';
import {formatBytesBase10} from 'sentry/utils/bytes/formatBytesBase10';
import {ABYTE_UNITS, SIZE_UNITS} from 'sentry/utils/discover/fieldRenderers';
import {DurationUnit, RATE_UNIT_LABELS, RateUnit} from 'sentry/utils/discover/fields';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import {formatPercentage} from 'sentry/utils/number/formatPercentage';
import {convertDuration} from 'sentry/utils/unitConversion/convertDuration';

import {isADurationUnit, isARateUnit} from '../common/typePredicates';

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
      const durationUnit = isADurationUnit(unit) ? unit : DurationUnit.MILLISECOND;
      const durationInMilliseconds = convertDuration(
        value,
        durationUnit,
        DurationUnit.MILLISECOND
      );
      return formatYAxisDuration(durationInMilliseconds);
    case 'size':
      // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      const bytes = value * SIZE_UNITS[unit ?? 'byte'];

      const formatter = ABYTE_UNITS.includes(unit ?? 'byte')
        ? formatBytesBase10
        : formatBytesBase2;

      return formatter(bytes);
    case 'rate':
      const rateUnit = isARateUnit(unit) ? unit : RateUnit.PER_SECOND;
      return `${value.toLocaleString(undefined, {
        notation: 'compact',
        maximumSignificantDigits: 6,
      })}${RATE_UNIT_LABELS[rateUnit]}`;
    default:
      return value.toString();
  }
}
