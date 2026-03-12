import type {Series} from 'sentry/types/echarts';
import type {AggregationOutputType, DataUnit} from 'sentry/utils/discover/fields';
import {
  SERIES_NAME_PART_DELIMITER,
  transformLegacySeriesToTimeSeries,
} from 'sentry/utils/timeSeries/transformLegacySeriesToTimeSeries';
import {getDatasetConfig} from 'sentry/views/dashboards/datasetConfig/base';
import type {Widget, WidgetQuery} from 'sentry/views/dashboards/types';
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
  const splitSeriesName = seriesName.split(SERIES_NAME_PART_DELIMITER);

  const yAxis =
    aggregates.find(aggregate => splitSeriesName.includes(aggregate)) ??
    aggregates[0] ??
    '';

  const widgetQuery =
    widget.queries.find(({name}) => name && splitSeriesName.includes(name)) ?? firstQuery;
  const queryName = widgetQuery?.name || undefined;

  const timeSeries = transformLegacySeriesToTimeSeries(
    series,
    timeseriesResultsTypes,
    timeseriesResultsUnits,
    columns,
    yAxis,
    queryName
  );

  if (!timeSeries) {
    return null;
  }

  // If the dataset config provides a custom label formatter, use it directly.
  const datasetConfig = getDatasetConfig(widget.widgetType);
  if (datasetConfig.formatSeriesLabel) {
    const label = datasetConfig.formatSeriesLabel(timeSeries, widgetQuery);
    return {timeSeries, label, seriesName, widgetQuery};
  }

  const fieldIndex = fields.indexOf(yAxis);
  // Only use field aliases for the yAxis if there are multiple yAxis and no group bys
  const fieldAlias =
    aggregates.length > 1 && columns.length === 0 && fieldIndex >= 0
      ? fieldAliases[fieldIndex]
      : undefined;

  const labelParts = [queryName, fieldAlias ?? formatTimeSeriesLabel(timeSeries)];
  // If there are multiple aggregates and columns, add the yAxis to the label for uniqueness
  if (aggregates.length > 1 && columns.length > 1) {
    labelParts.push(timeSeries.yAxis);
  }

  const label = labelParts
    .filter((part): part is string => part !== undefined)
    .join(SERIES_NAME_PART_DELIMITER);

  return {timeSeries, label, seriesName, widgetQuery};
}
