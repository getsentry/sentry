import {NAMESPACE_SYMBOL} from 'sentry/actionCreators/savedSearches';
import type {Series} from 'sentry/types/echarts';
import {SERIES_NAME_PART_DELIMITER} from 'sentry/utils/timeSeries/transformLegacySeriesToTimeSeries';
import type {Widget, WidgetQuery} from 'sentry/views/dashboards/types';

/**
 * Prefixes series names with the prettified query conditions when there are
 * multiple queries and no legend alias. This gives each query's series a
 * unique, human-readable prefix in the chart legend.
 *
 * Should be called in widget query hooks after `transformSeries`, since the
 * hooks know which query produced each series.
 */
export function labelSeriesForLegend(
  series: Series[],
  widgetQuery: WidgetQuery,
  widget: Widget
): Series[] {
  if (widget.queries.length <= 1 || widgetQuery.name) {
    return series;
  }

  const prefix = prettifyQueryConditions(widgetQuery.conditions);
  if (!prefix) {
    return series;
  }

  return series.map(s => ({
    ...s,
    seriesName: `${prefix}${SERIES_NAME_PART_DELIMITER}${s.seriesName}`,
  }));
}

const NAMESPACE_SYMBOL_PATTERN = new RegExp(
  `${NAMESPACE_SYMBOL}\\w+${NAMESPACE_SYMBOL}`,
  'g'
);

/**
 * Strips internal wildcard operator markers from a conditions string so it
 * reads naturally as a legend label. The search syntax uses {@link NAMESPACE_SYMBOL}
 * around operator names like "Contains" and "StartsWith".
 * For example, `transaction:\uf00dContains\uf00dissues` → `transaction:issues`.
 */
export function prettifyQueryConditions(
  conditions: string | undefined
): string | undefined {
  if (!conditions) {
    return undefined;
  }
  return conditions.replace(NAMESPACE_SYMBOL_PATTERN, '').replace(/\*/g, '');
}
