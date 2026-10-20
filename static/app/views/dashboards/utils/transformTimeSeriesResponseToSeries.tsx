import type {Series} from 'sentry/types/echarts';
import type {AggregationOutputType, DataUnit} from 'sentry/utils/discover/fields';
import type {EventsTimeSeriesResponse} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';
import type {WidgetQuery} from 'sentry/views/dashboards/types';
import {getLegacySeriesName} from 'sentry/views/dashboards/utils/transformTimeSeriesResponse';
import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';

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
