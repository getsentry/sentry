import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';
import {aggregateOutputType} from 'sentry/utils/discover/fields';
import {
  DAY,
  formatAbbreviatedNumber,
  formatPercentage,
  getDuration,
  HOUR,
  MINUTE,
  SECOND,
  WEEK,
} from 'sentry/utils/formatters';

interface Range {
  max: number;
  min: number;
}

/**
 * Formatter for chart tooltips that handle a variety of discover and metrics result values.
 * If the result is metric values, the value can be of type number or null
 */
export function tooltipFormatter(value: number | null, seriesName: string = ''): string {
  if (!defined(value)) {
    return '\u2014';
  }
  switch (aggregateOutputType(seriesName)) {
    case 'integer':
    case 'number':
      return value.toLocaleString();
    case 'percentage':
      return formatPercentage(value, 2);
    case 'duration':
      return getDuration(value / 1000, 2, true);
    default:
      return value.toString();
  }
}

/**
 * Formatter for chart axis labels that handle a variety of discover result values
 * This function is *very similar* to tooltipFormatter but outputs data with less precision.
 */
export function axisLabelFormatter(
  value: number,
  seriesName: string,
  abbreviation: boolean = false,
  range?: Range
): string {
  switch (aggregateOutputType(seriesName)) {
    case 'integer':
    case 'number':
      return abbreviation ? formatAbbreviatedNumber(value) : value.toLocaleString();
    case 'percentage':
      return formatPercentage(value, 0);
    case 'duration':
      let durationUnit;
      if (range) {
        durationUnit = categorizeDuration((range.max - range.min) * 0.5);
      }
      return axisDuration(value, durationUnit);
    default:
      return value.toString();
  }
}

/**
 * Specialized duration formatting for axis labels.
 * In that context we are ok sacrificing accuracy for more
 * consistent sizing.
 *
 * @param value Number of milliseconds to format.
 */
export function axisDuration(value: number, durationUnit?: number): string {
  durationUnit ??= categorizeDuration(value);
  if (value === 0) {
    return '0';
  }
  switch (durationUnit) {
    case WEEK: {
      const label = (value / WEEK).toFixed(0);
      return t('%swk', label);
    }
    case DAY: {
      const label = (value / DAY).toFixed(0);
      return t('%sd', label);
    }
    case HOUR: {
      const label = (value / HOUR).toFixed(0);
      return t('%shr', label);
    }
    case MINUTE: {
      const label = (value / MINUTE).toFixed(0);
      return t('%sm', label);
    }
    case SECOND: {
      const label = (value / SECOND).toFixed(0);
      return t('%ss', label);
    }
    default:
      const label = value.toFixed(0);
      return t('%sms', label);
  }
}

/**
 *
 * @param value
 */
function categorizeDuration(value): number {
  if (value >= WEEK) {
    return WEEK;
  }
  if (value >= DAY) {
    return DAY;
  }
  if (value >= HOUR) {
    return HOUR;
  }
  if (value >= MINUTE) {
    return MINUTE;
  }
  if (value >= SECOND) {
    return SECOND;
  }
  return 0;
}
