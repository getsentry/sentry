import {formatBytesBase2} from 'sentry/utils/bytes/formatBytesBase2';
import {formatBytesBase10} from 'sentry/utils/bytes/formatBytesBase10';
import {ABYTE_UNITS} from 'sentry/utils/discover/fieldRenderers';
import {DurationUnit, type RateUnit, SizeUnit} from 'sentry/utils/discover/fields';
import getDuration from 'sentry/utils/duration/getDuration';
import {formatCurrency, formatRate} from 'sentry/utils/formatters';
import {formatPercentage} from 'sentry/utils/number/formatPercentage';
import {ECHARTS_MISSING_DATA_VALUE} from 'sentry/utils/timeSeries/timeSeriesItemToEChartsDataPoint';
import {convertDuration} from 'sentry/utils/unitConversion/convertDuration';
import {convertSize} from 'sentry/utils/unitConversion/convertSize';
import {
  isADurationUnit,
  isASizeUnit,
} from 'sentry/views/dashboards/widgets/common/typePredicates';

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
    case 'score':
      // Scores are always integers, no half-marks.
      return value.toFixed(0);
    case 'currency':
      return formatCurrency(value);
    default:
      return value.toString();
  }
}
