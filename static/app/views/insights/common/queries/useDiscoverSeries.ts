import type {PageFilters} from 'sentry/types/core';
import type {Series} from 'sentry/types/echarts';
import {encodeSort, type EventsMetaType} from 'sentry/utils/discover/eventView';
import {
  useGenericDiscoverQuery,
  type DiscoverQueryProps,
} from 'sentry/utils/discover/genericDiscoverQuery';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import type {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import type {SamplingMode} from 'sentry/views/explore/hooks/useProgressiveQuery';
import {getSeriesEventView} from 'sentry/views/insights/common/queries/getSeriesEventView';
import {DEFAULT_SAMPLING_MODE} from 'sentry/views/insights/common/queries/useDiscover';
import {
  getRetryDelay,
  shouldRetryHandler,
} from 'sentry/views/insights/common/utils/retryHandlers';
import type {SpanProperty} from 'sentry/views/insights/types';

import {convertDiscoverTimeseriesResponse} from './convertDiscoverTimeseriesResponse';

export type DiscoverSeries = Series & {
  meta: EventsMetaType;
};

interface UseMetricsSeriesOptions<Fields> {
  enabled?: boolean;
  interval?: string;
  overriddenRoute?: string;
  referrer?: string;
  samplingMode?: SamplingMode;
  search?: MutableSearch | string;
  // TODO: Remove string type and always require MutableSearch
  transformAliasToInputFormat?: boolean;
  yAxis?: Fields;
}

export const useSpanSeries = <Fields extends SpanProperty[]>(
  options: UseMetricsSeriesOptions<Fields> = {},
  referrer: string,
  pageFilters?: PageFilters
) => {
  return useDiscoverSeries<Fields>(
    options,
    DiscoverDatasets.SPANS,
    referrer,
    pageFilters
  );
};

const useDiscoverSeries = <T extends string[]>(
  options: UseMetricsSeriesOptions<T> = {},
  dataset: DiscoverDatasets,
  referrer: string,
  pageFilters?: PageFilters
) => {
  const {
    search = undefined,
    yAxis = [],
    interval = undefined,
    samplingMode = DEFAULT_SAMPLING_MODE,
  } = options;

  const defaultPageFilters = usePageFilters();
  const location = useLocation();
  const organization = useOrganization();

  const eventView = getSeriesEventView(
    search,
    undefined,
    pageFilters || defaultPageFilters.selection,
    yAxis,
    undefined,
    dataset
  );

  if (interval) {
    eventView.interval = interval;
  }

  const result = useGenericDiscoverQuery<
    {
      data: any[];
      meta: EventsMetaType;
    },
    DiscoverQueryProps
  >({
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
      transformAliasToInputFormat: options.transformAliasToInputFormat ? '1' : '0',
      sampling: samplingMode,
    }),
    options: {
      enabled: options.enabled && defaultPageFilters.isReady,
      refetchOnWindowFocus: false,
      retry: shouldRetryHandler,
      retryDelay: getRetryDelay,
      staleTime: Infinity,
    },
    referrer,
  });

  const parsedData: Record<string, DiscoverSeries> = {};

  yAxis.forEach(seriesName => {
    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    const dataSeries = result.data?.[seriesName] ?? result?.data ?? {};
    const convertedSeries: DiscoverSeries = {
      seriesName,
      data: convertDiscoverTimeseriesResponse(dataSeries?.data ?? []),
      meta: dataSeries?.meta,
    };

    parsedData[seriesName] = convertedSeries;
  });

  return {...result, data: parsedData as Record<T[number], DiscoverSeries>};
};
