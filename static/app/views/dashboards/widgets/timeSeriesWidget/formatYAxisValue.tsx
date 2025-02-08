import {formatBytesBase2} from 'sentry/utils/bytes/formatBytesBase2';
import {formatBytesBase10} from 'sentry/utils/bytes/formatBytesBase10';
import {ABYTE_UNITS} from 'sentry/utils/discover/fieldRenderers';
import {
  DurationUnit,
  RATE_UNIT_LABELS,
  RateUnit,
  SizeUnit,
} from 'sentry/utils/discover/fields';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import {formatPercentage} from 'sentry/utils/number/formatPercentage';
import {convertDuration} from 'sentry/utils/unitConversion/convertDuration';
import {convertSize} from 'sentry/utils/unitConversion/convertSize';

import {isADurationUnit, isARateUnit, isASizeUnit} from '../common/typePredicates';

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
    case 'duration': {
      const durationUnit = isADurationUnit(unit) ? unit : DurationUnit.MILLISECOND;
      const durationInMilliseconds = convertDuration(
        value,
        durationUnit,
        DurationUnit.MILLISECOND
      );
      return formatYAxisDuration(durationInMilliseconds);
    }
    case 'size': {
      const sizeUnit = isASizeUnit(unit) ? unit : SizeUnit.BYTE;
      const sizeInBytes = convertSize(value, sizeUnit, SizeUnit.BYTE);

      const formatter = ABYTE_UNITS.includes(unit ?? 'byte')
        ? formatBytesBase10
        : formatBytesBase2;

      return formatter(sizeInBytes);
    }
    case 'rate': {
      // Always show rate in the original dataset's unit. If the unit is not
      // appropriate, always convert the unit in the original dataset first.
      // This way, named rate functions like `epm()` will be shows in per minute
      // units
      const rateUnit = isARateUnit(unit) ? unit : RateUnit.PER_SECOND;
      return `${value.toLocaleString(undefined, {
        notation: 'compact',
        maximumSignificantDigits: 6,
      })}${RATE_UNIT_LABELS[rateUnit]}`;
    }
    default:
      return value.toString();
  }
}
