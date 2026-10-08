import type {Series} from 'sentry/types/echarts';
import type {AggregationOutputType, DataUnit} from 'sentry/utils/discover/fields';
import {
  SERIES_NAME_PART_DELIMITER,
  SERIES_QUERY_DELIMITER,
} from 'sentry/utils/timeSeries/transformLegacySeriesToTimeSeries';
import type {EventsTimeSeriesResponse} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';
import type {WidgetQuery} from 'sentry/views/dashboards/types';
import type {
  TimeSeries,
  TimeSeriesGroupBy,
} from 'sentry/views/dashboards/widgets/common/types';

const OTHER_SERIES_NAME = 'Other';

export type WidgetSeries = Series & {
  timeSeries?: TimeSeries;
};

/**
 * Transforms the response from `/events-timeseries/` into a structure that matches
 * the legacy `/events-stats/` response format.
 *
 * @public
 */
export function transformTimeSeriesResponseToSeries(
  data: EventsTimeSeriesResponse,
  widgetQuery: WidgetQuery
): WidgetSeries[] {
  const hasMultipleYAxes = new Set(data.timeSeries.map(({yAxis}) => yAxis)).size > 1;
  const isGroupedQuery = widgetQuery.columns.length > 0;

  return data.timeSeries
    .toSorted((a, b) => (a.meta.order ?? 0) - (b.meta.order ?? 0))
    .map(timeSeries => ({
      seriesName: getLegacySeriesName(
        timeSeries,
        widgetQuery.name,
        hasMultipleYAxes,
        isGroupedQuery
      ),
      data: timeSeries.values.map(item => ({
        name: item.timestamp,
        value: item.value ?? 0,
      })),
      timeSeries,
    }));
}

/**
 * Mirrors how series names are constructed in `/events-stats/`
 */
function getLegacySeriesName(
  timeSeries: TimeSeries,
  alias: string | undefined,
  hasMultipleYAxes: boolean,
  isGroupedQuery: boolean
): string {
  const {yAxis} = timeSeries;
  const isGrouped =
    isGroupedQuery || timeSeries.meta.isOther || (timeSeries.groupBy?.length ?? 0) > 0;

  if (!isGrouped) {
    return alias ? `${alias}${SERIES_NAME_PART_DELIMITER}${yAxis}` : yAxis;
  }

  const groupName = timeSeries.meta.isOther
    ? OTHER_SERIES_NAME
    : getLegacyGroupName(timeSeries.groupBy ?? []);

  if (!hasMultipleYAxes) {
    return alias ? `${alias}${SERIES_NAME_PART_DELIMITER}${groupName}` : groupName;
  }

  const name = `${groupName}${SERIES_NAME_PART_DELIMITER}${yAxis}`;
  return alias ? `${alias}${SERIES_QUERY_DELIMITER}${name}` : name;
}

/**
 * Mirrors how group by values are joined in `/events-stats/` result keys
 */
function getLegacyGroupName(groupBy: TimeSeriesGroupBy[]): string {
  const groupName = groupBy
    .map(({value}) => {
      if (value === null) {
        return 'None';
      }
      if (Array.isArray(value)) {
        return `[${value.map(item => item ?? '(no value)').join(',')}]`;
      }
      if (typeof value === 'boolean') {
        return value ? 'True' : 'False';
      }
      return String(value);
    })
    .join(',');

  // A real group by value of "Other" would collide with the "Other" bucket, so
  // `/events-stats/` appends the first group by field to the key
  return groupName === OTHER_SERIES_NAME && groupBy[0]
    ? `${groupName} (${groupBy[0].key})`
    : groupName;
}

/** @public */
export function getTimeSeriesResultTypes(
  data: EventsTimeSeriesResponse
): Record<string, AggregationOutputType> {
  const result: Record<string, AggregationOutputType> = {};
  data.timeSeries.forEach(({yAxis, meta}) => {
    result[yAxis] = meta.valueType as AggregationOutputType;
  });
  return result;
}

/** @public */
export function getTimeSeriesResultUnits(
  data: EventsTimeSeriesResponse
): Record<string, DataUnit> {
  const result: Record<string, DataUnit> = {};
  data.timeSeries.forEach(({yAxis, meta}) => {
    result[yAxis] = meta.valueUnit as DataUnit;
  });
  return result;
}
