import type {MultiSeriesEventsStats} from 'sentry/types/organization';
import {encodeSort, type EventsMetaType} from 'sentry/utils/discover/eventView';
import type {Sort} from 'sentry/utils/discover/fields';
import {
  type DiscoverQueryProps,
  useGenericDiscoverQuery,
} from 'sentry/utils/discover/genericDiscoverQuery';
import type {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {getSeriesEventView} from 'sentry/views/insights/common/queries/getSeriesEventView';
import {
  getRetryDelay,
  shouldRetryHandler,
} from 'sentry/views/insights/common/utils/retryHandlers';
import type {SpanMetricsProperty} from 'sentry/views/insights/types';

import {convertDiscoverTimeseriesResponse} from './convertDiscoverTimeseriesResponse';
import type {DiscoverSeries} from './useDiscoverSeries';

interface UseSpanMetricsSeriesOptions<Fields> {
  topEvents: number;
  enabled?: boolean;
  fields?: Fields;
  referrer?: string;
  search?: MutableSearch;
  sorts?: Sort[];
  yAxis?: Fields;
}

export const useSpanMetricsTopNSeries = <Fields extends SpanMetricsProperty[]>(
  options: UseSpanMetricsSeriesOptions<Fields> = {topEvents: DEFAULT_EVENT_COUNT}
) => {
  const {
    search = undefined,
    fields = [],
    enabled,
    yAxis = [],
    topEvents,
    sorts = [],
    referrer = 'span-metrics-top-n-series',
  } = options;

  if (yAxis.length > 1) {
    throw new Error(
      'Multi-axis top-N queries are not supported by this hook. Try using `useSpansQuery` directly.'
    );
  }

  const location = useLocation();
  const organization = useOrganization();
  const pageFilters = usePageFilters();

  const eventView = getSeriesEventView(
    search,
    fields,
    pageFilters.selection,
    yAxis,
    topEvents
  );

  if (sorts.length > 0) {
    eventView.sorts = sorts;
  }

  const result = useGenericDiscoverQuery<MultiSeriesEventsStats, DiscoverQueryProps>({
    route: 'events-stats',
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
    },
    referrer,
  });

  const parsedData: Record<string, DiscoverSeries> = {};

  const data = result.data ?? {};

  Object.keys(data).forEach(seriesName => {
    const dataSeries = data[seriesName]!;

    const convertedSeries: DiscoverSeries = {
      seriesName,
      data: convertDiscoverTimeseriesResponse(dataSeries.data),
      meta: dataSeries?.meta as EventsMetaType,
    };

    parsedData[seriesName] = convertedSeries;
  });

  return {...result, data: parsedData};
};

const DEFAULT_EVENT_COUNT = 5;
