import {ECHARTS_MISSING_DATA_VALUE} from 'sentry/utils/timeSeries/timeSeriesItemToEChartsDataPoint';
import {NUMBER_MIN_VALUE} from 'sentry/views/dashboards/widgets/common/settings';

import {formatTooltipValue} from './formatTooltipValue';

/**
 * Format a value for the breakdown legend table under a chart.
 *
 * Similar to formatTooltipValue, but purpose-built for the legend context.
 * For small "number" values, shows a threshold indicator (e.g. "<0.0001")
 * rather than the full precision shown in chart tooltips.
 * Also handles null values, which are displayed as an em dash.
 */
export function formatBreakdownLegendValue(
  value: number | null | typeof ECHARTS_MISSING_DATA_VALUE,
  type: string,
  unit?: string
): string {
  if (value === null) {
    return '—';
  }

  if (
    type === 'number' &&
    typeof value === 'number' &&
    value > 0 &&
    value < NUMBER_MIN_VALUE
  ) {
    return `<${NUMBER_MIN_VALUE}`;
  }

  return formatTooltipValue(value, type, unit);
}
