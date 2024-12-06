import type {Series} from 'sentry/types/echarts';
import type {
  Confidence,
  EventsStats,
  GroupedMultiSeriesEventsStats,
  MultiSeriesEventsStats,
} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
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
import {determineSeriesConfidence} from 'sentry/views/alerts/rules/metric/utils/determineSeriesConfidence';
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

export function isEventsStats(
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

  // Single series, applies to single axis queries
  const firstYAxis = yAxis[0] || '';
  if (isEventsStats(result)) {
    const [, series] = processSingleEventStats(firstYAxis, result);
    return {
      [firstYAxis]: [series],
    };
  }

  // Multiple series, applies to multi axis or topN events queries
  const hasMultipleYAxes = yAxis.length > 1;
  if (isMultiSeriesEventsStats(result)) {
    const processedResults: [number, Series][] = Object.keys(result).map(seriesName =>
      processSingleEventStats(seriesName, result[seriesName])
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
        acc[series.seriesName] = [series];
        return acc;
      }, {});
  }

  // Grouped multi series, applies to topN events queries with multiple y-axes
  // First, we process the grouped multi series into a list of [seriesName, order, {[aggFunctionAlias]: EventsStats}]
  // to enable sorting.
  const processedResults: [string, number, MultiSeriesEventsStats][] = [];
  Object.keys(result).forEach(seriesName => {
    const {order: groupOrder, ...groupData} = result[seriesName];
    processedResults.push([seriesName, groupOrder || 0, groupData]);
  });

  return processedResults
    .sort(([, orderA], [, orderB]) => orderA - orderB)
    .reduce((acc, [seriesName, , groupData]) => {
      Object.keys(groupData).forEach(aggFunctionAlias => {
        const [, series] = processSingleEventStats(
          seriesName,
          groupData[aggFunctionAlias]
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

  const processedData: Series = {
    seriesName: seriesName || '(empty string)',
    data: seriesData.data.map(([timestamp, countsForTimestamp]) => ({
      name: timestamp * 1000,
      value: countsForTimestamp.reduce((acc, {count}) => acc + count, 0) * scale,
    })),
  };

  const confidence: Confidence = determineSeriesConfidence(seriesData);
  if (defined(confidence)) {
    processedData.confidence = confidence;
  }

  return [seriesData.order || 0, processedData];
}
