import {formatTooltipValue} from 'sentry/views/dashboards/widgets/timeSeriesWidget/formatters/formatTooltipValue';

/**
 * Format the Y-axis range shown for a heat map cell in its tooltip.
 *
 * Each cell spans a Y-axis bucket `[value, value + bucketSize)`. The tooltip
 * shows that range formatted with the metric's type and unit (e.g.
 * `"1.2s – 3.4s"`). When `bucketSize` is `0` the cell represents a single
 * discrete value rather than a range, so only that value is shown.
 */
export function formatTooltipYAxisValue(
  value: number,
  bucketSize: number,
  type: string,
  unit?: string
): string {
  const min = formatTooltipValue(value, type, unit);

  if (bucketSize === 0) {
    return min;
  }

  const max = formatTooltipValue(value + bucketSize, type, unit);

  return `${min} – ${max}`;
}
