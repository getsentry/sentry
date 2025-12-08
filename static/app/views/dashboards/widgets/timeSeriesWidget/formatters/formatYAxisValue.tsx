import {formatBytesBase2} from 'sentry/utils/bytes/formatBytesBase2';
import {formatBytesBase10} from 'sentry/utils/bytes/formatBytesBase10';
import {ABYTE_UNITS} from 'sentry/utils/discover/fieldRenderers';
import {
  DurationUnit,
  RATE_UNIT_LABELS,
  RateUnit,
  SizeUnit,
} from 'sentry/utils/discover/fields';
import {formatAbbreviatedNumber, formatDollars} from 'sentry/utils/formatters';
import {formatPercentage} from 'sentry/utils/number/formatPercentage';
import {convertDuration} from 'sentry/utils/unitConversion/convertDuration';
import {convertSize} from 'sentry/utils/unitConversion/convertSize';
import {
  isADurationUnit,
  isARateUnit,
  isASizeUnit,
} from 'sentry/views/dashboards/widgets/common/typePredicates';

import {formatYAxisDuration} from './formatYAxisDuration';

/**
 * Format a value for the Y axis on an ECharts graph.
 *
 * The values on the Y axis are chosen by ECharts. ECharts will automatically
 * select, when possible, nice round values. We always format the chosen value
 * at _full precision_ and trust EChart's choices. e.g., if it chooses "100", we
 * should show "100", because it probably chose a Y axis scale like "0, 100,
 * 200, 300". If it chooses "17.22" we should render "17.22" and not truncate
 * the value, since ECharts is probably using a scale like "17.20, 17.21, 17.22"
 * because the Y axis range is narrow. Similarly, a value like "0.00006"
 * probably means the range was narrow starting from 0, "0.00000, 0.00002
 * 0.00004 0.00006" and so on.
 *
 * This concept does not apply to:
 * 1. Integers. There are no fractional values!
 * 2. Durations. Durations have multiplier prefixes all the way down to nanoseconds, which should be enough. If needed, we can introduce smaller multipliers.
 * 3. Sizes. Sizes are effectively integers, and we have "byte" is already
 * small. It's an extremely rare case that we have fractional bytes with high
 * precision.
 * Rates and percentages would benefit from more precision, but it's not as critical there.
 *
 * The downside of this approach is that if the precision varies on the scale
 * (e.g., "0, 0.5, 1, 1.5") the Y axis labels are not well-aligned. This is a
 * limitation of ECharts, since it doesn't provide information about the entire
 * scale to each number. The ideal solution here would be to coordinate the
 * formatting of all the values.
 */
export function formatYAxisValue(value: number, type: string, unit?: string): string {
  if (value === 0) {
    return '0';
  }

  switch (type) {
    case 'integer':
      return formatAbbreviatedNumber(value);
    case 'number':
      return value.toLocaleString(undefined, {
        maximumFractionDigits: 20,
      });
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
    case 'currency': {
      return formatDollars(value);
    }
    default:
      return value.toString();
  }
}
