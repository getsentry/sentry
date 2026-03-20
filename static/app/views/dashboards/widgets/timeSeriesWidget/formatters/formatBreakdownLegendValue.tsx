import {ECHARTS_MISSING_DATA_VALUE} from 'sentry/utils/timeSeries/timeSeriesItemToEChartsDataPoint';

import {formatTooltipValue} from './formatTooltipValue';

/**
 * Format a value for the breakdown legend table under a chart.
 *
 * Similar to formatTooltipValue, but purpose-built for the legend context.
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

  return formatTooltipValue(value, type, unit);
}
