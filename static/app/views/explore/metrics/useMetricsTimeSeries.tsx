import {useMemo} from 'react';

import type {
  EventsStats,
  GroupedMultiSeriesEventsStats,
  MultiSeriesEventsStats,
} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import {encodeSort} from 'sentry/utils/discover/eventView';
import {
  useGenericDiscoverQuery,
  type DiscoverQueryProps,
} from 'sentry/utils/discover/genericDiscoverQuery';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {intervalToMilliseconds} from 'sentry/utils/duration/intervalToMilliseconds';
import type {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {
  isEventsStats,
  isMultiSeriesEventsStats,
} from 'sentry/views/dashboards/utils/isEventsStats';
import type {
  TimeSeries,
  TimeSeriesItem,
} from 'sentry/views/dashboards/widgets/common/types';
import type {SamplingMode} from 'sentry/views/explore/hooks/useProgressiveQuery';
import {FALLBACK_SERIES_NAME} from 'sentry/views/explore/settings';
import {getSeriesEventView} from 'sentry/views/insights/common/queries/getSeriesEventView';
import {
  getRetryDelay,
  shouldRetryHandler,
} from 'sentry/views/insights/common/utils/retryHandlers';

type SeriesMap = Record<string, TimeSeries[]>;

interface Options {
  disableAggregateExtrapolation?: string;
  enabled?: boolean;
  fields?: string[];
  interval?: string;
  orderby?: string | string[];
  overriddenRoute?: string;
  referrer?: string;
  samplingMode?: SamplingMode;
  search?: MutableSearch;
  topEvents?: number;
  yAxis?: string[];
}

/**
 * Custom hook for metrics timeseries that ensures the correct dataset (tracemetrics) is used
 */
export const useMetricsTimeSeries = (options: Options = {}, referrer: string) => {
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
    samplingMode,
    disableAggregateExtrapolation,
  } = options;

  const pageFilters = usePageFilters();

  // Use METRICS dataset for EventView creation (internal processing)
  const eventView = getSeriesEventView(
    search,
    fields,
    pageFilters.selection,
    yAxis,
    topEvents,
    DiscoverDatasets.METRICS,
    orderby
  );

  if (interval) {
    eventView.interval = interval;
  }

  const usesRelativeDateRange =
    !defined(eventView.start) &&
    !defined(eventView.end) &&
    defined(eventView.statsPeriod);

  const intervalInMilliseconds = eventView.interval
    ? intervalToMilliseconds(eventView.interval)
    : undefined;

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
      sampling: samplingMode,
      disableAggregateExtrapolation,
      // Override dataset to tracemetrics for API call
      dataset: 'tracemetrics',
      // Timeseries requests do not support cursors, overwrite it to undefined so
      // pagination does not cause extra requests
      cursor: undefined,
    }),
    options: {
      enabled: enabled && pageFilters.isReady,
      refetchOnWindowFocus: false,
      retry: shouldRetryHandler,
      retryDelay: getRetryDelay,
      staleTime:
        usesRelativeDateRange &&
        defined(intervalInMilliseconds) &&
        intervalInMilliseconds !== 0
          ? intervalInMilliseconds
          : Infinity,
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

function transformToSeriesMap(
  result: MultiSeriesEventsStats | GroupedMultiSeriesEventsStats | undefined,
  yAxis: string[]
): SeriesMap {
  const seriesMap: SeriesMap = {};

  if (!result) {
    return seriesMap;
  }

  if (isEventsStats(result)) {
    // Single series
    const series = transformEventStatsToTimeSeries(result, yAxis[0] || 'count()');
    if (series) {
      seriesMap[yAxis[0] || FALLBACK_SERIES_NAME] = [series];
    }
  } else if (isMultiSeriesEventsStats(result)) {
    // Multi series
    Object.entries(result).forEach(([seriesName, eventsStats]) => {
      const series = transformEventStatsToTimeSeries(eventsStats, yAxis[0] || 'count()');
      if (series) {
        seriesMap[seriesName] = [series];
      }
    });
  }

  return seriesMap;
}

function transformEventStatsToTimeSeries(
  eventsStats: EventsStats,
  yAxis: string
): TimeSeries | null {
  if (!eventsStats?.data) {
    return null;
  }

  const values: TimeSeriesItem[] = eventsStats.data.map(([timestamp, counts]) => ({
    timestamp: timestamp * 1000,
    value: counts[0]?.count ?? 0,
  }));

  return {
    meta: {
      interval: 0, // Will be set by the chart component
      valueType: 'number' as const,
      valueUnit: null,
    },
    values,
    yAxis,
  };
}
