import {
  WEEK,
  DAY,
  HOUR,
  MINUTE,
  SECOND,
  getDuration,
  formatPercentage,
} from 'app/utils/formatters';
import {t} from 'app/locale';
import {aggregateOutputType} from 'app/utils/discover/fields';

/**
 * Formatter for chart tooltips that handle a variety of discover result values
 */
export function tooltipFormatter(value: number, seriesName: string): string {
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
 * This function is *very similar* to tootipFormatter but outputs data with less precision.
 */
export function axisLabelFormatter(value: number, seriesName: string): string {
  switch (aggregateOutputType(seriesName)) {
    case 'integer':
    case 'number':
      return value.toLocaleString();
    case 'percentage':
      return formatPercentage(value, 0);
    case 'duration':
      return axisDuration(value);
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
function axisDuration(value: number): string {
  if (value === 0) {
    return '0';
  }
  if (value >= WEEK) {
    const label = (value / WEEK).toFixed(0);
    return t('%swk', label);
  }
  if (value >= DAY) {
    const label = (value / DAY).toFixed(0);
    return t('%sd', label);
  }
  if (value >= HOUR) {
    const label = (value / HOUR).toFixed(0);
    return t('%shr', label);
  }
  if (value >= MINUTE) {
    const label = (value / MINUTE).toFixed(0);
    return t('%smin', label);
  }
  if (value >= SECOND) {
    const label = (value / SECOND).toFixed(0);
    return t('%ss', label);
  }
  const label = (value / SECOND).toFixed(1);
  return t('%ss', label);
}
