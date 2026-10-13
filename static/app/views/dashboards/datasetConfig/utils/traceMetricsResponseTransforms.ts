import type {EventsTableData} from 'sentry/utils/discover/discoverQuery';
import {
  parseFunction,
  RateUnit,
  type AggregationOutputType,
  type DataUnit,
} from 'sentry/utils/discover/fields';
import type {EventsTimeSeriesResponse} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';
import {type DatasetConfig} from 'sentry/views/dashboards/datasetConfig/base';
import {transformEventsResponseToTable} from 'sentry/views/dashboards/datasetConfig/events';
import {type WidgetQuery} from 'sentry/views/dashboards/types';
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
  'transformTable' | 'transformSeries' | 'getSeriesResultType' | 'getSeriesResultUnit'
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
  transformSeries: (data, widgetQuery) => {
    return data.timeSeries.map(timeSeries => {
      // The function should always be defined when dealing with a successful
      // time series response
      return {
        data: timeSeries.values.map(value => ({
          name: value.timestamp,
          value: value.value ?? 0,
        })),

        seriesName: formatMetricsTimeseriesLabel({
          widgetQuery,
          timeSeries,
        }),
        timeSeries,
      };
    });
  },
  getSeriesResultType(data, _widgetQuery) {
    return data.timeSeries.reduce<Record<string, AggregationOutputType>>(
      (acc, timeSeries) => {
        acc[timeSeries.yAxis] = timeSeries.meta.valueType as AggregationOutputType;
        return acc;
      },
      {}
    );
  },
  getSeriesResultUnit: (data, _widgetQuery) => {
    return data.timeSeries.reduce<Record<string, DataUnit>>((acc, timeSeries) => {
      if (timeSeries.yAxis.includes('per_second(')) {
        acc[timeSeries.yAxis] = RateUnit.PER_SECOND;
      } else if (timeSeries.yAxis.includes('per_minute(')) {
        acc[timeSeries.yAxis] = RateUnit.PER_MINUTE;
      } else {
        acc[timeSeries.yAxis] = timeSeries.meta.valueUnit;
      }
      return acc;
    }, {});
  },
};
