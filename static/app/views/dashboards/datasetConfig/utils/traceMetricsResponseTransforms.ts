import type {EventsTableData} from 'sentry/utils/discover/discoverQuery';
import {
  explodeFieldString,
  FractionUnit,
  parseFunction,
  RateUnit,
} from 'sentry/utils/discover/fields';
import type {EventsTimeSeriesResponse} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';
import {type DatasetConfig} from 'sentry/views/dashboards/datasetConfig/base';
import {transformEventsResponseToTable} from 'sentry/views/dashboards/datasetConfig/events';
import {type WidgetQuery} from 'sentry/views/dashboards/types';
import {transformTimeSeriesResponse} from 'sentry/views/dashboards/utils/transformTimeSeriesResponse';
import {
  isWebVitalScoreBreakdownChart,
  webVitalScoreField,
} from 'sentry/views/dashboards/utils/webVitalTraceMetricFields';
import {getTraceMetricFunctionParts} from 'sentry/views/dashboards/widgetBuilder/utils/buildTraceMetricAggregate';
import {transformPerformanceScoreBreakdownTimeSeries} from 'sentry/views/dashboards/widgetBuilder/utils/transformPerformanceScoreBreakdownSeries';
import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';
import {formatTimeSeriesLabel} from 'sentry/views/dashboards/widgets/timeSeriesWidget/formatters/formatTimeSeriesLabel';
import {formatTimeSeriesName} from 'sentry/views/dashboards/widgets/timeSeriesWidget/formatters/formatTimeSeriesName';
import {findVirtualTraceMetricByAttribute} from 'sentry/views/explore/metrics/virtualMetrics';

const UNITLESS_AGGREGATIONS = new Set(['count', 'per_second', 'per_minute']);

/**
 * When aggregating metric attributes, Event endpoints return the unit and
 * type of the main metric, not the unit or type of the attribute.
 *
 * This function returns the value type of the attribute for known metric attributes.
 * (Currently only ratio type for web vital scores)
 * TODO: Update backend to return the metric attribute's unit and type
 */
function getVirtualMetricValueType(
  field: string
): TimeSeries['meta']['valueType'] | undefined {
  const parts = getTraceMetricFunctionParts(explodeFieldString(field));
  const [attribute, name, type] = parts?.args ?? [];
  if (
    !parts ||
    !attribute ||
    attribute === 'value' ||
    !name ||
    !type ||
    UNITLESS_AGGREGATIONS.has(parts.aggregation)
  ) {
    return undefined;
  }
  const virtual = findVirtualTraceMetricByAttribute(attribute, {name, type});
  if (!virtual) {
    return undefined;
  }
  return virtual.unit === FractionUnit.RATIO ? 'percentage' : 'number';
}

function withVirtualMetricValueTypes(
  data: EventsTimeSeriesResponse
): EventsTimeSeriesResponse {
  return {
    ...data,
    timeSeries: data.timeSeries.map(timeSeries => {
      const valueType = getVirtualMetricValueType(timeSeries.yAxis);
      return valueType
        ? {...timeSeries, meta: {...timeSeries.meta, valueType, valueUnit: null}}
        : timeSeries;
    }),
  };
}

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
        } else {
          const valueType = getVirtualMetricValueType(key);
          if (valueType) {
            delete transformedData.meta!.units![key];
            transformedData.meta!.fields[key] = valueType;
          }
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
        : withVirtualMetricValueTypes(data),
      widget,
      queryIndex,
      {
        getSeriesName: (timeSeries, widgetQuery) =>
          formatTimeSeriesName({
            ...timeSeries,
            yAxis: formatMetricsTimeseriesLabel({widgetQuery, timeSeries}),
            groupBy: [],
          }),
        // Score breakdown charts undergo frontend side transformations that change
        // the value type of the series to `score`.
        meta: isScoreBreakdown ? {valueType: 'score', valueUnit: null} : undefined,
      }
    );
  },
};
