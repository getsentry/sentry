import {getDuration, formatPercentage} from 'app/utils/formatters';
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
      if (value === 0) {
        return '0';
      }
      return getDuration(value / 1000, 0, true);
    default:
      return value.toString();
  }
}
