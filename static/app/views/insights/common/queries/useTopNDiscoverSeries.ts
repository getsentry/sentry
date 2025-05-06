import type {PageFilters} from 'sentry/types/core';
import type {Series} from 'sentry/types/echarts';
import type {MultiSeriesEventsStats} from 'sentry/types/organization';
import {encodeSort, type EventsMetaType} from 'sentry/utils/discover/eventView';
import {
  type DiscoverQueryProps,
  useGenericDiscoverQuery,
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
import {useInsightsEap} from 'sentry/views/insights/common/utils/useEap';
import type {
  MetricsProperty,
  SpanFunctions,
  SpanIndexedField,
  SpanMetricsProperty,
} from 'sentry/views/insights/types';

import {convertDiscoverTimeseriesResponse} from './convertDiscoverTimeseriesResponse';

export type DiscoverSeries = Series & {
  meta: EventsMetaType;
};

interface UseMetricsSeriesOptions<Fields> {
  fields: Fields;
  topN: number;
  yAxis: Fields;
  enabled?: boolean;
  interval?: string;
  overriddenRoute?: string;
  referrer?: string;
  samplingMode?: SamplingMode | 'NONE';
  search?: MutableSearch | string;
  // TODO: Remove string type and always require MutableSearch
  transformAliasToInputFormat?: boolean;
}

export const useTopNSpanMetricsSeries = <Fields extends SpanMetricsProperty[]>(
  options: UseMetricsSeriesOptions<Fields>,
  referrer: string,
  pageFilters?: PageFilters
) => {
  const useEap = useInsightsEap();
  return useTopNDiscoverSeries<Fields>(
    options,
    useEap ? DiscoverDatasets.SPANS_EAP_RPC : DiscoverDatasets.SPANS_METRICS,
    referrer,
    pageFilters
  );
};

export const useTopNSpanEAPSeries = <
  Fields extends
    | MetricsProperty[]
    | SpanMetricsProperty[]
    | SpanIndexedField[]
    | SpanFunctions[]
    | string[],
>(
  options: UseMetricsSeriesOptions<Fields>,
  referrer: string
) => {
  return useTopNDiscoverSeries<Fields>(options, DiscoverDatasets.SPANS_EAP_RPC, referrer);
};

export const useTopNMetricsSeries = <Fields extends MetricsProperty[]>(
  options: UseMetricsSeriesOptions<Fields>,
  referrer: string,
  pageFilters?: PageFilters
) => {
  const useEap = useInsightsEap();
  return useTopNDiscoverSeries<Fields>(
    options,
    useEap ? DiscoverDatasets.SPANS_EAP_RPC : DiscoverDatasets.METRICS,
    referrer,
    pageFilters
  );
};

/**
 * TODO: Remove string type, added to fix types for 'count()'
 */
export const useTopNSpanIndexedSeries = <
  Fields extends SpanIndexedField[] | SpanFunctions[] | string[],
>(
  options: UseMetricsSeriesOptions<Fields>,
  referrer: string,
  dataset?: DiscoverDatasets
) => {
  const useEap = useInsightsEap();
  return useTopNDiscoverSeries<Fields>(
    options,
    useEap ? DiscoverDatasets.SPANS_EAP_RPC : (dataset ?? DiscoverDatasets.SPANS_INDEXED),
    referrer
  );
};

const useTopNDiscoverSeries = <T extends string[]>(
  options: UseMetricsSeriesOptions<T>,
  dataset: DiscoverDatasets,
  referrer: string,
  pageFilters?: PageFilters
) => {
  const {
    search = undefined,
    yAxis = [],
    fields = [],
    topN,
    interval = undefined,
    samplingMode = DEFAULT_SAMPLING_MODE,
  } = options;

  const defaultPageFilters = usePageFilters();
  const location = useLocation();
  const organization = useOrganization();

  // TODO: remove this check with eap
  const shouldSetSamplingMode = dataset === DiscoverDatasets.SPANS_EAP_RPC;

  const eventView = getSeriesEventView(
    search,
    fields,
    pageFilters || defaultPageFilters.selection,
    yAxis,
    topN,
    dataset
  );

  if (interval) {
    eventView.interval = interval;
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
      transformAliasToInputFormat: options.transformAliasToInputFormat ? '1' : '0',
      sampling:
        samplingMode === 'NONE' || !shouldSetSamplingMode ? undefined : samplingMode,
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

  const parsedData: DiscoverSeries[] = [];

  const seriesData = result.data ?? {};

  if (!('data' in seriesData)) {
    Object.keys(seriesData).forEach(seriesName => {
      const data = seriesData[seriesName]?.data ?? [];
      const meta = (seriesData[seriesName]?.meta ?? {}) as EventsMetaType;
      parsedData.push({
        seriesName,
        data: convertDiscoverTimeseriesResponse(data),
        meta,
      });
    });
  }

  return {...result, data: parsedData};
};
