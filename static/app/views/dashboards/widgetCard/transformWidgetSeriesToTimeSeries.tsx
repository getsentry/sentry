import type {Series} from 'sentry/types/echarts';
import type {AggregationOutputType, DataUnit} from 'sentry/utils/discover/fields';
import {
  SERIES_NAME_PART_DELIMITER,
  SERIES_QUERY_DELIMITER,
  transformLegacySeriesToTimeSeries,
} from 'sentry/utils/timeSeries/transformLegacySeriesToTimeSeries';
import {formatTraceMetricsFunction} from 'sentry/views/dashboards/datasetConfig/traceMetrics';
import {WidgetType, type Widget, type WidgetQuery} from 'sentry/views/dashboards/types';
import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';
import {formatTimeSeriesLabel} from 'sentry/views/dashboards/widgets/timeSeriesWidget/formatters/formatTimeSeriesLabel';

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
  series: Series,
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
  const fields = firstQuery?.fields ?? [...columns, ...aggregates];
  const fieldAliases = firstQuery?.fieldAliases ?? [];

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
        return splitUnprefixedName.includes(
          formatTraceMetricsFunction(aggregate) as string
        );
      }
      return splitUnprefixedName.includes(aggregate);
    }) ??
    aggregates[0] ??
    '';

  const timeSeries = transformLegacySeriesToTimeSeries(
    effectiveSeries,
    timeseriesResultsTypes,
    timeseriesResultsUnits,
    columns,
    yAxis,
    effectiveQueryName
  );

  if (!timeSeries) {
    return null;
  }

  const fieldIndex = fields.indexOf(yAxis);
  // Only use field aliases for the yAxis if there are multiple yAxis and no group bys
  const fieldAlias =
    aggregates.length > 1 && columns.length === 0 && fieldIndex >= 0
      ? fieldAliases[fieldIndex]
      : undefined;

  const labelParts = [
    effectiveQueryName,
    fieldAlias ?? formatTimeSeriesLabel(timeSeries),
  ];
  // If there are multiple aggregates and columns, add the yAxis to the label for uniqueness
  if (aggregates.length > 1 && columns.length > 0) {
    if (widget.widgetType === WidgetType.TRACEMETRICS) {
      // TraceMetrics widgets need to format the yAxis for the label
      labelParts.push(formatTraceMetricsFunction(yAxis) as string);
    } else {
      labelParts.push(yAxis);
    }
  }

  const label = labelParts
    .filter((part): part is string => part !== undefined)
    .join(SERIES_NAME_PART_DELIMITER);

  return {timeSeries, label, seriesName, widgetQuery};
}
