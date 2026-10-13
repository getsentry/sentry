import type {PageFilters} from 'sentry/types/core';
import type {Series} from 'sentry/types/echarts';
import type {
  EventsStats,
  MultiSeriesEventsStats,
  Organization,
} from 'sentry/types/organization';
import type {TableData} from 'sentry/utils/discover/discoverQuery';
import type {AggregationOutputType, DataUnit} from 'sentry/utils/discover/fields';
import {SizeUnit} from 'sentry/utils/discover/fields';
import type {EventsTimeSeriesResponse} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';
import type {DatasetConfig} from 'sentry/views/dashboards/datasetConfig/base';
import type {WidgetQuery} from 'sentry/views/dashboards/types';
import {
  isEventsStats,
  isEventsTimeSeriesResponse,
  isMultiSeriesEventsStats,
} from 'sentry/views/dashboards/utils/isEventsStats';
import {
  transformTimeSeriesResponseToSeries,
  type WidgetSeries,
} from 'sentry/views/dashboards/utils/transformTimeSeriesResponseToSeries';

function buildSeriesResultMap<T extends AggregationOutputType | DataUnit>(
  data: EventsStats | MultiSeriesEventsStats | EventsTimeSeriesResponse,
  widgetQuery: WidgetQuery,
  value: T
): Record<string, T> {
  const result: Record<string, T> = {};

  for (const aggregate of widgetQuery.aggregates ?? []) {
    result[aggregate] = value;
  }

  if (isMultiSeriesEventsStats(data)) {
    for (const seriesName of Object.keys(data)) {
      result[seriesName] = value;
    }
  }

  return result;
}

function transformTimeSeriesResponse(
  data: EventsTimeSeriesResponse,
  widgetQuery: WidgetQuery
): WidgetSeries[] {
  const aggregate = widgetQuery.aggregates?.[0] || widgetQuery.fields?.[0] || 'App Size';
  const series = transformTimeSeriesResponseToSeries(data, widgetQuery);

  if (series.length === 1 && !series[0]!.timeSeries?.groupBy?.length) {
    const seriesName = widgetQuery.name || aggregate;

    return [{...removeEmptyBuckets(series[0]!), seriesName}];
  }

  return series.map(removeEmptyBuckets);
}

function removeEmptyBuckets(series: WidgetSeries): WidgetSeries {
  const values = (series.timeSeries?.values ?? []).filter(
    ({value}) => value !== null && value !== undefined && value !== 0
  );

  return {
    ...series,
    data: values.map(({timestamp, value}) => ({name: timestamp, value: value!})),
    timeSeries: series.timeSeries ? {...series.timeSeries, values} : undefined,
  };
}

export const MobileAppSizeResponseTransforms: Pick<
  DatasetConfig<
    EventsStats | MultiSeriesEventsStats | EventsTimeSeriesResponse,
    TableData
  >,
  'transformTable' | 'transformSeries' | 'getSeriesResultType' | 'getSeriesResultUnit'
> = {
  transformTable: (
    data: TableData,
    _widgetQuery: WidgetQuery,
    _organization: Organization,
    _pageFilters: PageFilters
  ): TableData => {
    return data;
  },
  transformSeries: (
    data: EventsStats | MultiSeriesEventsStats | EventsTimeSeriesResponse,
    widgetQuery: WidgetQuery,
    _organization: Organization
  ): Series[] => {
    if (!data) {
      return [];
    }

    if (isEventsTimeSeriesResponse(data)) {
      return transformTimeSeriesResponse(data, widgetQuery);
    }

    const aggregate =
      widgetQuery.aggregates?.[0] || widgetQuery.fields?.[0] || 'App Size';

    if (isEventsStats(data)) {
      const seriesData = data.data
        .filter(
          ([, values]) =>
            values[0]?.count !== null &&
            values[0]?.count !== undefined &&
            values[0]?.count !== 0
        )
        .map(([timestamp, values]) => ({
          name: timestamp * 1000,
          value: values[0]!.count,
        }));

      const seriesName = widgetQuery.name || aggregate;

      return [{seriesName, data: seriesData}];
    }

    const multiResponse = data;
    const seriesWithOrder: Array<{order: number; series: Series}> = [];

    for (const [groupName, groupData] of Object.entries(multiResponse)) {
      if (!groupData?.data || !Array.isArray(groupData.data)) {
        continue;
      }

      const seriesData = groupData.data
        .filter(
          ([, values]) =>
            values[0]?.count !== null &&
            values[0]?.count !== undefined &&
            values[0]?.count !== 0
        )
        .map(([timestamp, values]) => ({
          name: timestamp * 1000,
          value: values[0]!.count,
        }));

      const seriesName = widgetQuery.name
        ? `${widgetQuery.name} : ${groupName}`
        : groupName;

      seriesWithOrder.push({
        order: groupData.order ?? 0,
        series: {seriesName, data: seriesData},
      });
    }

    return seriesWithOrder.sort((a, b) => a.order - b.order).map(item => item.series);
  },
  getSeriesResultType: (data, widgetQuery) =>
    buildSeriesResultMap(data, widgetQuery, 'size'),
  getSeriesResultUnit: (data, widgetQuery) =>
    buildSeriesResultMap(data, widgetQuery, SizeUnit.BYTE),
};
