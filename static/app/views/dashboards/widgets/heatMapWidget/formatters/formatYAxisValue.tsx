import {formatBytesBase2} from 'sentry/utils/bytes/formatBytesBase2';
import {formatBytesBase10} from 'sentry/utils/bytes/formatBytesBase10';
import {ABYTE_UNITS, RATE_UNIT_LABELS} from 'sentry/utils/discover/fields';
import {DurationUnit, RateUnit, SizeUnit} from 'sentry/utils/discover/fieldsBase';
import {formatAbbreviatedNumber, formatDollars} from 'sentry/utils/formatters';
import {formatNumberWithDynamicDecimalPoints} from 'sentry/utils/number/formatNumberWithDynamicDecimalPoints';
import {formatPercentage} from 'sentry/utils/number/formatPercentage';
import {convertDuration} from 'sentry/utils/unitConversion/convertDuration';
import {convertSize} from 'sentry/utils/unitConversion/convertSize';
import {
  NUMBER_MIN_VALUE,
  NUMBER_MAX_FRACTION_DIGITS,
} from 'sentry/views/dashboards/widgets/common/settings';
import {
  isADurationUnit,
  isARateUnit,
  isASizeUnit,
} from 'sentry/views/dashboards/widgets/common/typePredicates';
import {formatYAxisDuration} from 'sentry/views/dashboards/widgets/timeSeriesWidget/formatters/formatYAxisDuration';

/**
 * Format a value for the Y axis on an ECharts heat map graph.
 *
 * The values on the Y axis are chosen by ECharts. ECharts will automatically
 * select, when possible, nice round values. With heat maps this is not the case.
 * Since the Y axis in heat maps are considered categories to ECharts,
 * We need to format the values ourselves to the precision we'd like to see,
 * especially with floating point numbers.
 *
 * The rest of the logic is the same as the time series widget Y axis formatter
 * (static/app/views/dashboards/widgets/timeSeriesWidget/formatters/formatYAxisValue.tsx).
 */
export function formatYAxisValue(value: number, type: string, unit?: string): string {
  if (value === 0) {
    return '0';
  }

  switch (type) {
    case 'integer':
      return formatAbbreviatedNumber(value);
    case 'number':
      if (Number.isInteger(value)) {
        return formatAbbreviatedNumber(value);
      }
      if (value > 0 && value < NUMBER_MIN_VALUE) {
        return value.toLocaleString(undefined, {
          maximumSignificantDigits: NUMBER_MAX_FRACTION_DIGITS,
        });
      }
      return formatNumberWithDynamicDecimalPoints(value);
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
