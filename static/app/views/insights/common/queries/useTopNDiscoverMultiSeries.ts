import type {PageFilters} from 'sentry/types/core';
import type {EventsStats, MultiSeriesEventsStats} from 'sentry/types/organization';
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
import type {DiscoverSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';
import {
  getRetryDelay,
  shouldRetryHandler,
} from 'sentry/views/insights/common/utils/retryHandlers';
import {useInsightsEap} from 'sentry/views/insights/common/utils/useEap';
import type {MetricsProperty} from 'sentry/views/insights/types';

import {convertDiscoverTimeseriesResponse} from './convertDiscoverTimeseriesResponse';

interface UseMetricsSeriesOptions<YAxisFields, Fields> {
  fields: Fields;
  topN: number;
  yAxis: YAxisFields;
  enabled?: boolean;
  interval?: string;
  overriddenRoute?: string;
  referrer?: string;
  samplingMode?: SamplingMode;
  search?: MutableSearch | string;
  // TODO: Remove string type and always require MutableSearch
  transformAliasToInputFormat?: boolean;
}

export const useTopNMetricsMultiSeries = <
  YAxisFields extends MetricsProperty[],
  Fields extends MetricsProperty[],
>(
  options: UseMetricsSeriesOptions<YAxisFields, Fields>,
  referrer: string,
  pageFilters?: PageFilters
) => {
  const useEap = useInsightsEap();
  return useTopNDiscoverMultiSeries<YAxisFields, Fields>(
    options,
    useEap ? DiscoverDatasets.SPANS_EAP_RPC : DiscoverDatasets.METRICS,
    referrer,
    pageFilters
  );
};

const useTopNDiscoverMultiSeries = <
  YAxisFields extends string[],
  Fields extends string[],
>(
  options: UseMetricsSeriesOptions<YAxisFields, Fields>,
  dataset: DiscoverDatasets,
  referrer: string,
  pageFilters?: PageFilters
) => {
  const {
    search = undefined,
    yAxis,
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
    [...fields, ...yAxis],
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
      sampling: shouldSetSamplingMode ? samplingMode : undefined,
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

  const parsedData: Array<{
    data: Record<YAxisFields[number], DiscoverSeries>;
    name: string;
  }> = [];

  const seriesData = result.data ?? {};
  // Typically the response is an object, with the key being the series name and the value being the series data
  // However, if there is no series returned, the response is just single series object (and hence the 'data' key is present in the object)
  if (!seriesData?.data) {
    Object.keys(seriesData).forEach(name => {
      const data = {} as Record<YAxisFields[number], DiscoverSeries>;
      yAxis.forEach((axis: YAxisFields[number]) => {
        const axisSeriesData = seriesData[name] as Record<
          YAxisFields[number],
          EventsStats
        >;
        data[axis] = parseSeriesData(name, axisSeriesData[axis]);
      });
      parsedData.push({data, name});
    });
  }

  return {...result, data: parsedData};
};

const parseSeriesData = (
  seriesName: string,
  seriesData: EventsStats | undefined
): DiscoverSeries => {
  const data = seriesData?.data ?? [];
  const meta = (seriesData?.meta ?? {}) as EventsMetaType;

  return {
    seriesName,
    data: convertDiscoverTimeseriesResponse(data),
    meta,
  };
};
