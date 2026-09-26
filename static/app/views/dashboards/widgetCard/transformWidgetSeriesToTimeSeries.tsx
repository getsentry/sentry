import type {AggregationOutputType, DataUnit} from 'sentry/utils/discover/fields';
import {
  SERIES_NAME_PART_DELIMITER,
  SERIES_QUERY_DELIMITER,
  transformLegacySeriesToTimeSeries,
} from 'sentry/utils/timeSeries/transformLegacySeriesToTimeSeries';
import {formatTraceMetricsFunction} from 'sentry/views/dashboards/datasetConfig/traceMetrics';
import {WidgetType, type Widget, type WidgetQuery} from 'sentry/views/dashboards/types';
import type {WidgetSeries} from 'sentry/views/dashboards/utils/transformTimeSeriesResponseToSeries';
import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';
import {formatTimeSeriesLabelForWidgetQuery} from 'sentry/views/dashboards/widgets/timeSeriesWidget/formatters/formatTimeSeriesLabelForWidgetQuery';

interface TransformedSeries {
  label: string;
  seriesName: string;
  timeSeries: TimeSeries;
  widgetQuery: WidgetQuery;
}

/**
 * Transforms a legacy echarts Series into a TimeSeries using the widget's
 * query configuration, and computes a display label that matches the chart legend.
 */
export function transformWidgetSeriesToTimeSeries(
  series: WidgetSeries,
  widget: Widget,
  timeseriesResultsTypes?: Record<string, AggregationOutputType>,
  timeseriesResultsUnits?: Record<string, DataUnit>
): TransformedSeries | null {
  const firstQuery = widget.queries[0];
  if (!firstQuery) {
    return null;
  }
  const aggregates = firstQuery?.aggregates ?? [];
  const columns = firstQuery?.columns ?? [];

  const seriesName = series.seriesName ?? aggregates[0] ?? '';

  // The query prefix (alias or conditions) is separated by ' > ' from the
  // rest of the series name. This is set by transformEventsResponseToSeries
  // (for aliases with group-by) and getSeriesQueryPrefix (for conditions).
  const queryDelimiterIndex = seriesName.indexOf(SERIES_QUERY_DELIMITER);
  const queryName =
    queryDelimiterIndex >= 0 ? seriesName.slice(0, queryDelimiterIndex) : undefined;
  const unprefixedName =
    queryDelimiterIndex >= 0
      ? seriesName.slice(queryDelimiterIndex + SERIES_QUERY_DELIMITER.length)
      : seriesName;

  // If no ' > ' delimiter, try matching by alias in the ' : ' delimited parts.
  // This handles the alias-without-group-by case where transformEventsResponseToSeries
  // uses ' : ' (e.g., "Chrome : count()").
  const splitSeriesName = seriesName.split(SERIES_NAME_PART_DELIMITER);
  const splitUnprefixedName =
    queryDelimiterIndex >= 0
      ? unprefixedName.split(SERIES_NAME_PART_DELIMITER)
      : splitSeriesName;
  const widgetQuery =
    widget.queries.find(({conditions}) => conditions && queryName === conditions) ??
    // When there's a group-by, an alias prefix is glued to the group-by value
    // with the ' > ' delimiter (e.g., "http > (no value) : count()"), so the
    // bare alias never appears as a ' : ' delimited part. Match the extracted
    // prefix against the query name directly to avoid falling back to the first
    // query and mislabeling every series with its name.
    widget.queries.find(({name}) => name && queryName === name) ??
    widget.queries.find(({name}) => name && splitSeriesName.includes(name)) ??
    firstQuery;
  const effectiveQueryName = queryName ?? (widgetQuery?.name || undefined);

  // Pass the unprefixed series name so transformLegacySeriesToTimeSeries
  // doesn't misinterpret the query prefix as a group-by value.
  const effectiveSeries =
    queryDelimiterIndex >= 0 ? {...series, seriesName: unprefixedName} : series;

  const yAxis =
    aggregates.find(aggregate => {
      if (widget.widgetType === WidgetType.TRACEMETRICS) {
        return splitUnprefixedName.includes(formatTraceMetricsFunction(aggregate));
      }
      return splitUnprefixedName.includes(aggregate);
    }) ??
    aggregates[0] ??
    '';

  const timeSeriesFromLegacySeries = transformLegacySeriesToTimeSeries(
    effectiveSeries,
    timeseriesResultsTypes,
    timeseriesResultsUnits,
    columns,
    yAxis,
    effectiveQueryName
  );

  if (!timeSeriesFromLegacySeries) {
    return null;
  }

  // If there exists a timeSeries payload, we merge it with the
  // legacy series, since timeSeries carries metadata that the
  // legacy series does not. ie incomplete buckets, etc.
  const timeSeries: TimeSeries = series.timeSeries
    ? {
        ...timeSeriesFromLegacySeries,
        values: series.timeSeries.values.map(item => ({
          ...item,
          value: item.value ?? 0,
        })),
        meta: {
          ...series.timeSeries.meta,
          // Use the widget's value type and unit, not the response, since some datasets
          // override them (e.g., mobile app size is always bytes)
          valueType: timeSeriesFromLegacySeries.meta.valueType,
          valueUnit: timeSeriesFromLegacySeries.meta.valueUnit,
        },
      }
    : timeSeriesFromLegacySeries;

  const label = formatTimeSeriesLabelForWidgetQuery(timeSeries, widget, widgetQuery);

  return {timeSeries, label, seriesName, widgetQuery};
}
