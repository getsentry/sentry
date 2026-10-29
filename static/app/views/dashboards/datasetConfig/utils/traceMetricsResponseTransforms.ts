import type {EventsTableData} from 'sentry/utils/discover/discoverQuery';
import {parseFunction, RateUnit} from 'sentry/utils/discover/fields';
import type {EventsTimeSeriesResponse} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';
import {type DatasetConfig} from 'sentry/views/dashboards/datasetConfig/base';
import {transformEventsResponseToTable} from 'sentry/views/dashboards/datasetConfig/events';
import {type WidgetQuery} from 'sentry/views/dashboards/types';
import {transformTimeSeriesResponse} from 'sentry/views/dashboards/utils/transformTimeSeriesResponse';
import {
  isWebVitalScoreBreakdownChart,
  webVitalScoreField,
} from 'sentry/views/dashboards/utils/webVitalTraceMetricFields';
import {transformPerformanceScoreBreakdownTimeSeries} from 'sentry/views/dashboards/widgetBuilder/utils/transformPerformanceScoreBreakdownSeries';
import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';
import {formatTimeSeriesLabel} from 'sentry/views/dashboards/widgets/timeSeriesWidget/formatters/formatTimeSeriesLabel';

function formatMetricsTimeseriesLabel({
  widgetQuery,
  timeSeries,
}: {
  timeSeries: TimeSeries;
  widgetQuery: WidgetQuery;
}): string {
  const func = parseFunction(timeSeries.yAxis);
  const formattedYAxis = func
    ? `${func.name}(${func.arguments[1] ?? '…'})`
    : timeSeries.yAxis;

  const multiYAxis = new Set(widgetQuery.aggregates).size > 1;
  const hasGroupings = new Set(widgetQuery.columns).size > 0;

  let baseName = formatTimeSeriesLabel({...timeSeries, yAxis: formattedYAxis});

  // When we have both multiple aggregates and groupings, append function name for uniqueness
  if (multiYAxis && hasGroupings && func) {
    baseName = `${baseName} : ${func.name}(${func.arguments[1] ?? '…'})`;
  }

  // Add query name prefix with appropriate separator if an alias is present
  if (widgetQuery.name) {
    const separator = multiYAxis && hasGroupings ? ' > ' : ' : ';
    return `${widgetQuery.name}${separator}${baseName}`;
  }

  return baseName;
}

export const traceMetricsResponseTransforms: Pick<
  DatasetConfig<EventsTimeSeriesResponse, EventsTableData>,
  'transformTable' | 'transformTimeSeries'
> = {
  transformTable: (data, widgetQuery) => {
    const transformedData = transformEventsResponseToTable(data, widgetQuery);

    // Inject the rate units for per_second and per_minute functions explicitly
    // because the response does not include these units
    if (transformedData.meta?.units) {
      Object.keys(transformedData.meta.units).forEach(key => {
        const parsedFunction = parseFunction(key);
        if (parsedFunction?.name === 'per_second') {
          transformedData.meta!.units![key] = RateUnit.PER_SECOND;
        } else if (parsedFunction?.name === 'per_minute') {
          transformedData.meta!.units![key] = RateUnit.PER_MINUTE;
        }
      });
    }
    return transformedData;
  },
  transformTimeSeries: (data, widget, queryIndex) => {
    const isScoreBreakdown = isWebVitalScoreBreakdownChart(widget.queries[queryIndex]!);
    return transformTimeSeriesResponse(
      isScoreBreakdown
        ? transformPerformanceScoreBreakdownTimeSeries(data, webVitalScoreField)
        : data,
      widget,
      queryIndex,
      {
        getSeriesName: (timeSeries, widgetQuery) =>
          formatMetricsTimeseriesLabel({widgetQuery, timeSeries}),
        // Score breakdown charts undergo frontend side transformations that change
        // the value type of the series to `score`.
        meta: isScoreBreakdown ? {valueType: 'score', valueUnit: null} : undefined,
      }
    );
  },
};
