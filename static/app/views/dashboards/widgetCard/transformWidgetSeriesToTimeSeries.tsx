import type {Series} from 'sentry/types/echarts';
import {defined} from 'sentry/utils/defined';
import {
  SERIES_NAME_PART_DELIMITER,
  SERIES_QUERY_DELIMITER,
  transformLegacySeriesToTimeSeries,
} from 'sentry/utils/timeSeries/transformLegacySeriesToTimeSeries';
import type {Widget, WidgetQuery} from 'sentry/views/dashboards/types';
import {getSeriesQueryPrefix} from 'sentry/views/dashboards/utils/getSeriesQueryPrefix';
import type {WidgetTimeSeries} from 'sentry/views/dashboards/utils/transformTimeSeriesResponse';

/**
 * Transforms a list of legacy echarts Series into a list of TimeSeries using the widget's
 * query configuration.
 */
export function transformMultipleWidgetSeriesToTimeSeries(
  series: Series[],
  widget: Widget,
  queryIndex: number
): WidgetTimeSeries[] {
  const widgetQuery = widget.queries[queryIndex];
  if (!widgetQuery) {
    return [];
  }
  const queryPrefix = getSeriesQueryPrefix(widgetQuery, widget);
  const {aggregates, columns} = widgetQuery;

  return series
    .map(item => {
      const seriesName = queryPrefix
        ? `${queryPrefix}${SERIES_QUERY_DELIMITER}${item.seriesName}`
        : item.seriesName;
      const unprefixedName = stripAliasPrefix(item.seriesName, widgetQuery);
      const nameParts = unprefixedName.split(SERIES_NAME_PART_DELIMITER);
      const yAxis =
        aggregates.find(aggregate => nameParts.includes(aggregate)) ??
        aggregates[0] ??
        '';
      const timeSeries = transformLegacySeriesToTimeSeries(
        {...item, seriesName: unprefixedName},
        columns,
        yAxis
      );
      return timeSeries ? {queryIndex, widgetQuery, seriesName, timeSeries} : null;
    })
    .filter(defined);
}

/**
 * `transformSeries` prefixes series names with the query's legend alias, using
 * ' > ' when the name also carries group-by values and ' : ' otherwise.
 * Remove only that prefix: a group-by value may equal the alias.
 */
function stripAliasPrefix(seriesName: string, {name}: WidgetQuery): string {
  if (!name) {
    return seriesName;
  }
  for (const delimiter of [SERIES_QUERY_DELIMITER, SERIES_NAME_PART_DELIMITER]) {
    const prefix = `${name}${delimiter}`;
    if (seriesName.startsWith(prefix)) {
      return seriesName.slice(prefix.length);
    }
  }
  return seriesName;
}
