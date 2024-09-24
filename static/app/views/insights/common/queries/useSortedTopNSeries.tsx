import type {Series} from 'sentry/types/echarts';
import type {
  EventsStats,
  GroupedMultiSeriesEventsStats,
  MultiSeriesEventsStats,
} from 'sentry/types/organization';
import {encodeSort} from 'sentry/utils/discover/eventView';
import {DURATION_UNITS, SIZE_UNITS} from 'sentry/utils/discover/fieldRenderers';
import {getAggregateAlias} from 'sentry/utils/discover/fields';
import {
  type DiscoverQueryProps,
  useGenericDiscoverQuery,
} from 'sentry/utils/discover/genericDiscoverQuery';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import type {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {getSeriesEventView} from 'sentry/views/insights/common/queries/getSeriesEventView';
import type {SpanFunctions, SpanIndexedField} from 'sentry/views/insights/types';

import {getRetryDelay, shouldRetryHandler} from '../utils/retryHandlers';

type SeriesMap = {
  [seriesName: string]: Series[];
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

export const useSortedTopNSeries = <
  Fields extends SpanIndexedField[] | SpanFunctions[] | string[],
>(
  options: Options<Fields> = {},
  referrer: string,
  dataset?: DiscoverDatasets
) => {
  const location = useLocation();
  const organization = useOrganization();
  const {
    search = undefined,
    yAxis = [],
    interval = undefined,
    topEvents = 5,
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

  const data: SeriesMap = isFetchingOrLoading
    ? {}
    : transformToSeriesMap(result.data, yAxis);

  const pageLinks = result.response?.getResponseHeader('Link') ?? undefined;

  return {
    ...result,
    pageLinks,
    data,
    meta: result.data?.meta,
  };
};

function isEventsStats(
  obj: EventsStats | MultiSeriesEventsStats | GroupedMultiSeriesEventsStats
): obj is EventsStats {
  return typeof obj === 'object' && obj !== null && typeof obj.data === 'object';
}

function isMultiSeriesEventsStats(
  obj: EventsStats | MultiSeriesEventsStats | GroupedMultiSeriesEventsStats
): obj is MultiSeriesEventsStats {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  return Object.values(obj).every(series => isEventsStats(series));
}

function transformToSeriesMap(
  result: MultiSeriesEventsStats | GroupedMultiSeriesEventsStats | undefined,
  yAxis: string[]
): SeriesMap {
  if (!result) {
    return {};
  }

  if (isMultiSeriesEventsStats(result)) {
    const firstYAxis = yAxis[0] || '';

    const processedResults: [number, Series][] = Object.keys(result).map(seriesName =>
      processSingleEventStats(seriesName, result[seriesName])
    );

    return {
      [firstYAxis]: processedResults
        .sort(([a], [b]) => a - b)
        .map(([, series]) => series),
    };
  }

  const processed: [string, number, MultiSeriesEventsStats][] = [];
  Object.keys(result).forEach(seriesName => {
    const {order: groupOrder, ...groupData} = result[seriesName];
    processed.push([seriesName, groupOrder || 0, groupData]);
  });

  const map: SeriesMap = {};
  processed
    .sort(([, orderA], [, orderB]) => orderA - orderB)
    .forEach(([seriesName, , groupData]) => {
      Object.keys(groupData).forEach(aggFunctionAlias => {
        const [, series] = processSingleEventStats(
          seriesName,
          groupData[aggFunctionAlias]
        );
        if (!map[aggFunctionAlias]) {
          map[aggFunctionAlias] = [series];
        } else {
          map[aggFunctionAlias].push(series);
        }
      });
    });

  return map;
}

function processSingleEventStats(
  seriesName: string,
  seriesData: EventsStats
): [number, Series] {
  let scale = 1;
  if (seriesName) {
    const unit = seriesData.meta?.units?.[getAggregateAlias(seriesName)];
    // Scale series values to milliseconds or bytes depending on units from meta
    scale = (unit && (DURATION_UNITS[unit] ?? SIZE_UNITS[unit])) ?? 1;
  }

  const processsedData: Series = {
    seriesName: seriesName || '(empty string)',
    data: seriesData.data.map(([timestamp, countsForTimestamp]) => ({
      name: timestamp * 1000,
      value: countsForTimestamp.reduce((acc, {count}) => acc + count, 0) * scale,
    })),
  };

  return [seriesData.order || 0, processsedData];
}
