import {formatBytesBase2} from 'sentry/utils/bytes/formatBytesBase2';
import {formatBytesBase10} from 'sentry/utils/bytes/formatBytesBase10';
import {ABYTE_UNITS} from 'sentry/utils/discover/fieldRenderers';
import {DurationUnit, SizeUnit, type RateUnit} from 'sentry/utils/discover/fields';
import getDuration from 'sentry/utils/duration/getDuration';
import {formatDollars, formatRate} from 'sentry/utils/formatters';
import {formatPercentage} from 'sentry/utils/number/formatPercentage';
import {ECHARTS_MISSING_DATA_VALUE} from 'sentry/utils/timeSeries/timeSeriesItemToEChartsDataPoint';
import {convertDuration} from 'sentry/utils/unitConversion/convertDuration';
import {convertSize} from 'sentry/utils/unitConversion/convertSize';
import {
  isADurationUnit,
  isASizeUnit,
} from 'sentry/views/dashboards/widgets/common/typePredicates';

/**
 * Format a value for the tooltip on an ECharts graph.
 *
 * The value might be a user submitted metric, or an aggregate. For user metric
 * values, it's wise to render the value at full precision, since the user might
 * be interested in the exact value, and tooltips should generally show the full
 * value. For aggregates, the precision is contrived, and the significant digits
 * might not match the original data. In this case, it would be wise to truncate
 * the value for display purposes, but we opt to do the safer thing and show the
 * value at full precision.
 *
 * This concept mostly applies to "number" values, since integers, durations,
 * and sizes naturally require less precision.
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
    case 'number':
      return value.toLocaleString(undefined, {
        maximumFractionDigits: 20,
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
