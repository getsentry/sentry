import {formatBytesBase2} from 'sentry/utils/bytes/formatBytesBase2';
import {formatBytesBase10} from 'sentry/utils/bytes/formatBytesBase10';
import {
  ABYTE_UNITS,
  DurationUnit,
  SizeUnit,
  type RateUnit,
} from 'sentry/utils/discover/fields';
import {getDuration} from 'sentry/utils/duration/getDuration';
import {formatDollars, formatRate} from 'sentry/utils/formatters';
import {formatPercentage} from 'sentry/utils/number/formatPercentage';
import {ECHARTS_MISSING_DATA_VALUE} from 'sentry/utils/timeSeries/timeSeriesItemToEChartsDataPoint';
import {convertDuration} from 'sentry/utils/unitConversion/convertDuration';
import {convertSize} from 'sentry/utils/unitConversion/convertSize';
import {
  NUMBER_MAX_FRACTION_DIGITS,
  NUMBER_MIN_VALUE,
} from 'sentry/views/dashboards/widgets/common/settings';
import {
  isADurationUnit,
  isASizeUnit,
} from 'sentry/views/dashboards/widgets/common/typePredicates';

/**
 * Format a value for the tooltip on an ECharts graph.
 *
 * For "number" values, we cap fractional digits at 4 to keep tooltips readable,
 * especially for percentage-like charts in prebuilt dashboards. Integers,
 * durations, and sizes naturally require less precision.
 */
export function formatTooltipValue(
  value: number | typeof ECHARTS_MISSING_DATA_VALUE,
  type: string,
  unit?: string
): string {
  if (value === ECHARTS_MISSING_DATA_VALUE) {
    return value;
  }

  switch (type) {
    case 'integer':
      return value.toLocaleString(undefined, {
        maximumFractionDigits: NUMBER_MAX_FRACTION_DIGITS,
      });
    case 'number':
      if (value > 0 && value < NUMBER_MIN_VALUE) {
        return `<${NUMBER_MIN_VALUE}`;
      }
      return value.toLocaleString(undefined, {
        maximumFractionDigits: NUMBER_MAX_FRACTION_DIGITS,
      });
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
    case 'score':
      // Scores are always integers, no half-marks.
      return value.toFixed(0);
    case 'currency':
      return formatDollars(value);
    default:
      return value.toString();
  }
}
