import {formatBytesBase2} from 'sentry/utils/bytes/formatBytesBase2';
import {formatBytesBase10} from 'sentry/utils/bytes/formatBytesBase10';
import {ABYTE_UNITS} from 'sentry/utils/discover/fieldRenderers';
import {DurationUnit, type RateUnit, SizeUnit} from 'sentry/utils/discover/fields';
import getDuration from 'sentry/utils/duration/getDuration';
import {formatRate} from 'sentry/utils/formatters';
import {formatPercentage} from 'sentry/utils/number/formatPercentage';
import {convertDuration} from 'sentry/utils/unitConversion/convertDuration';
import {convertSize} from 'sentry/utils/unitConversion/convertSize';

import {isADurationUnit, isASizeUnit} from '../common/typePredicates';

export function formatTooltipValue(value: number, type: string, unit?: string): string {
  switch (type) {
    case 'integer':
    case 'number':
      return value.toLocaleString();
    case 'percentage':
      return formatPercentage(value, 2);
    case 'duration': {
      const durationUnit = isADurationUnit(unit) ? unit : DurationUnit.MILLISECOND;
      const durationInSeconds = convertDuration(value, durationUnit, DurationUnit.SECOND);

      return getDuration(durationInSeconds, 2, true);
    }
    case 'size': {
      const sizeUnit = isASizeUnit(unit) ? unit : SizeUnit.BYTE;
      const sizeInBytes = convertSize(value, sizeUnit, SizeUnit.BYTE);

      const formatter = ABYTE_UNITS.includes(unit ?? 'byte')
        ? formatBytesBase10
        : formatBytesBase2;

      return formatter(sizeInBytes);
    }
    case 'rate':
      // Always show rate in the original dataset's unit. If the unit is not
      // appropriate, always convert the unit in the original dataset first.
      // This way, named rate functions like `epm()` will be shows in per minute
      // units
      return formatRate(value, unit as RateUnit);
    default:
      return value.toString();
  }
}
