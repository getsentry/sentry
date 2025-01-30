import {useMemo} from 'react';

import type {
  EventsStats,
  GroupedMultiSeriesEventsStats,
  MultiSeriesEventsStats,
} from 'sentry/types/organization';
import {encodeSort} from 'sentry/utils/discover/eventView';
import {
  type DiscoverQueryProps,
  useGenericDiscoverQuery,
} from 'sentry/utils/discover/genericDiscoverQuery';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import type {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {determineSeriesConfidence} from 'sentry/views/alerts/rules/metric/utils/determineSeriesConfidence';
import type {TimeseriesData} from 'sentry/views/dashboards/widgets/common/types';
import {getSeriesEventView} from 'sentry/views/insights/common/queries/getSeriesEventView';
import type {SpanFunctions, SpanIndexedField} from 'sentry/views/insights/types';

import {
  isEventsStats,
  isMultiSeriesEventsStats,
} from '../../../dashboards/utils/isEventsStats';
import {getRetryDelay, shouldRetryHandler} from '../utils/retryHandlers';

type SeriesMap = {
  [seriesName: string]: TimeseriesData[];
};

interface Options<Fields> {
  enabled?: boolean;
  fields?: string[];
  interval?: string;
  orderby?: string | string[];
  overriddenRoute?: string;
  referrer?: string;
  search?: MutableSearch;
  topEvents?: number;
  yAxis?: Fields;
}

export const useSortedTimeSeries = <
  Fields extends SpanIndexedField[] | SpanFunctions[] | string[],
>(
  options: Options<Fields> = {},
  referrer: string,
  dataset?: DiscoverDatasets
) => {
  const location = useLocation();
  const organization = useOrganization();
  const {
    search,
    yAxis = [],
    interval,
    topEvents,
    fields,
    orderby,
    overriddenRoute,
    enabled,
  } = options;

  const pageFilters = usePageFilters();

  const eventView = getSeriesEventView(
    search,
    fields,
    pageFilters.selection,
    yAxis,
    topEvents,
    dataset ?? DiscoverDatasets.SPANS_INDEXED,
    orderby
  );

  if (interval) {
    eventView.interval = interval;
  }

  const result = useGenericDiscoverQuery<
    MultiSeriesEventsStats | GroupedMultiSeriesEventsStats,
    DiscoverQueryProps
  >({
    route: overriddenRoute ?? 'events-stats',
    eventView,
    location,
    orgSlug: organization.slug,
    getRequestPayload: () => ({
      ...eventView.getEventsAPIPayload(location),
      yAxis: eventView.yAxis,
      topEvents: eventView.topEvents,
      excludeOther: 0,
      partial: 1,
      orderby: eventView.sorts?.[0] ? encodeSort(eventView.sorts?.[0]) : undefined,
      interval: eventView.interval,
    }),
    options: {
      enabled: enabled && pageFilters.isReady,
      refetchOnWindowFocus: false,
      retry: shouldRetryHandler,
      retryDelay: getRetryDelay,
      staleTime: Infinity,
    },
    referrer,
  });

  const isFetchingOrLoading = result.isPending || result.isFetching;

  const data: SeriesMap = useMemo(() => {
    return isFetchingOrLoading ? {} : transformToSeriesMap(result.data, yAxis);
  }, [isFetchingOrLoading, result.data, yAxis]);

  const pageLinks = result.response?.getResponseHeader('Link') ?? undefined;

  return {
    ...result,
    pageLinks,
    data,
    meta: result.data?.meta,
  };
};

export function transformToSeriesMap(
  result: MultiSeriesEventsStats | GroupedMultiSeriesEventsStats | undefined,
  yAxis: string[]
): SeriesMap {
  if (!result) {
    return {};
  }

  // Single series, applies to single axis queries
  const firstYAxis = yAxis[0] || '';
  if (isEventsStats(result)) {
    const [, series] = convertEventsStatsToTimeSeriesData(firstYAxis, result);
    return {
      [firstYAxis]: [series],
    };
  }

  // Multiple series, applies to multi axis or topN events queries
  const hasMultipleYAxes = yAxis.length > 1;
  if (isMultiSeriesEventsStats(result)) {
    const processedResults: Array<[number, TimeseriesData]> = Object.keys(result).map(
      seriesName => convertEventsStatsToTimeSeriesData(seriesName, result[seriesName]!)
    );

    if (!hasMultipleYAxes) {
      return {
        [firstYAxis]: processedResults
          .sort(([a], [b]) => a - b)
          .map(([, series]) => series),
      };
    }

    return processedResults
      .sort(([a], [b]) => a - b)
      .reduce((acc, [, series]) => {
        acc[series.field] = [series];
        return acc;
      }, {} as SeriesMap);
  }

  // Grouped multi series, applies to topN events queries with multiple y-axes
  // First, we process the grouped multi series into a list of [seriesName, order, {[aggFunctionAlias]: EventsStats}]
  // to enable sorting.
  const processedResults: Array<[string, number, MultiSeriesEventsStats]> = [];
  Object.keys(result).forEach(groupName => {
    const {order: groupOrder, ...groupData} = result[groupName]!;
    processedResults.push([
      groupName,
      groupOrder || 0,
      groupData as MultiSeriesEventsStats,
    ]);
  });

  return processedResults
    .sort(([, orderA], [, orderB]) => orderA - orderB)
    .reduce((acc, [seriesName, , groupData]) => {
      Object.keys(groupData).forEach(aggFunctionAlias => {
        const [, series] = convertEventsStatsToTimeSeriesData(
          seriesName,
          groupData[aggFunctionAlias]!
        );

        if (!acc[aggFunctionAlias]) {
          acc[aggFunctionAlias] = [series];
        } else {
          acc[aggFunctionAlias].push(series);
        }
      });
      return acc;
    }, {} as SeriesMap);
}

function convertEventsStatsToTimeSeriesData(
  seriesName: string,
  seriesData: EventsStats
): [number, TimeseriesData] {
  const serie: TimeseriesData = {
    field: seriesName,
    data: seriesData.data.map(([timestamp, countsForTimestamp]) => ({
      timestamp: new Date(timestamp * 1000).toISOString(),
      value: countsForTimestamp.reduce((acc, {count}) => acc + count, 0),
    })),
    meta: {
      fields: seriesData.meta!.fields,
      units: seriesData.meta?.units,
    },
    confidence: determineSeriesConfidence(seriesData),
  };

  return [seriesData.order ?? 0, serie];
}
