import type {PageFilters} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import type {TableData} from 'sentry/utils/discover/discoverQuery';
import type {AggregationOutputType, DataUnit} from 'sentry/utils/discover/fields';
import {SizeUnit} from 'sentry/utils/discover/fields';
import type {EventsTimeSeriesResponse} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';
import type {DatasetConfig} from 'sentry/views/dashboards/datasetConfig/base';
import type {Widget, WidgetQuery} from 'sentry/views/dashboards/types';
import {
  transformTimeSeriesResponse,
  type WidgetTimeSeries,
} from 'sentry/views/dashboards/utils/transformTimeSeriesResponse';

function buildSeriesResultMap<T extends AggregationOutputType | DataUnit>(
  widgetQuery: WidgetQuery,
  value: T
): Record<string, T> {
  const result: Record<string, T> = {};

  for (const aggregate of widgetQuery.aggregates ?? []) {
    result[aggregate] = value;
  }

  return result;
}

function transformTimeSeries(
  data: EventsTimeSeriesResponse,
  widget: Widget,
  queryIndex: number
): WidgetTimeSeries[] {
  const isSingleUngroupedSeries =
    data.timeSeries.length === 1 && !data.timeSeries[0]!.groupBy?.length;

  return transformTimeSeriesResponse(data, widget, queryIndex, {
    meta: {valueType: 'size', valueUnit: SizeUnit.BYTE},
    getSeriesName: isSingleUngroupedSeries
      ? (_timeSeries, widgetQuery) =>
          widgetQuery.name ||
          widgetQuery.aggregates?.[0] ||
          widgetQuery.fields?.[0] ||
          'App Size'
      : undefined,
  }).map(item => ({
    ...item,
    timeSeries: {
      ...item.timeSeries,
      values: item.timeSeries.values.filter(
        ({value}) => value !== null && value !== undefined && value !== 0 // Removes empty buckets, matching legacy behavior
      ),
    },
  }));
}

export const mobileAppSizeResponseTransforms: Pick<
  DatasetConfig<EventsTimeSeriesResponse, TableData>,
  'transformTable' | 'transformTimeSeries' | 'getSeriesResultType' | 'getSeriesResultUnit'
> = {
  transformTable: (
    data: TableData,
    _widgetQuery: WidgetQuery,
    _organization: Organization,
    _pageFilters: PageFilters
  ): TableData => {
    return data;
  },
  transformTimeSeries,
  getSeriesResultType: (_data, widgetQuery) => buildSeriesResultMap(widgetQuery, 'size'),
  getSeriesResultUnit: (_data, widgetQuery) =>
    buildSeriesResultMap(widgetQuery, SizeUnit.BYTE),
};
