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

export type WidgetSeries = Series & {
  timeSeries?: TimeSeries;
};

/**
 * Series names match the old `/events-stats/` names, since legends and saved
 * legend selections rely on them.
 */
export function transformTimeSeriesResponseToSeries(
  data: EventsTimeSeriesResponse,
  widgetQuery: WidgetQuery
): WidgetSeries[] {
  const hasMultipleYAxes = new Set(data.timeSeries.map(({yAxis}) => yAxis)).size > 1;

  return data.timeSeries
    .toSorted((a, b) => (a.meta.order ?? 0) - (b.meta.order ?? 0))
    .map(timeSeries => ({
      seriesName: getLegacySeriesName(timeSeries, widgetQuery.name, hasMultipleYAxes),
      data: timeSeries.values.map(item => ({
        name: item.timestamp,
        value: item.value ?? 0,
      })),
      timeSeries,
    }));
}

export function getLegacySeriesName(
  timeSeries: TimeSeries,
  alias: string | undefined,
  hasMultipleYAxes: boolean
): string {
  const {yAxis} = timeSeries;
  const isGrouped = timeSeries.meta.isOther || (timeSeries.groupBy?.length ?? 0) > 0;

  if (!isGrouped) {
    return alias ? `${alias}${SERIES_NAME_PART_DELIMITER}${yAxis}` : yAxis;
  }

  const groupName = timeSeries.meta.isOther
    ? 'Other'
    : getLegacyGroupName(timeSeries.groupBy ?? []);

  if (!hasMultipleYAxes) {
    return alias ? `${alias}${SERIES_NAME_PART_DELIMITER}${groupName}` : groupName;
  }

  const name = `${groupName}${SERIES_NAME_PART_DELIMITER}${yAxis}`;
  return alias ? `${alias}${SERIES_QUERY_DELIMITER}${name}` : name;
}

/**
 * Joins group by values the same way `/events-stats/` built its result keys
 */
function getLegacyGroupName(groupBy: TimeSeriesGroupBy[]): string {
  return groupBy
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
}

export function getTimeSeriesResultTypes(
  data: EventsTimeSeriesResponse
): Record<string, AggregationOutputType> {
  const result: Record<string, AggregationOutputType> = {};
  data.timeSeries.forEach(({yAxis, meta}) => {
    result[yAxis] = meta.valueType as AggregationOutputType;
  });
  return result;
}

export function getTimeSeriesResultUnits(
  data: EventsTimeSeriesResponse
): Record<string, DataUnit> {
  const result: Record<string, DataUnit> = {};
  data.timeSeries.forEach(({yAxis, meta}) => {
    result[yAxis] = meta.valueUnit as DataUnit;
  });
  return result;
}
