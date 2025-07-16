import type {PageFilters} from 'sentry/types/core';
import type {MultiSeriesEventsStats} from 'sentry/types/organization';
import {encodeSort, type EventsMetaType} from 'sentry/utils/discover/eventView';
import type {Sort} from 'sentry/utils/discover/fields';
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
import type {
  EAPSpanProperty,
  SpanFunctions,
  SpanIndexedField,
  SpanMetricsProperty,
} from 'sentry/views/insights/types';

import {convertDiscoverTimeseriesResponse} from './convertDiscoverTimeseriesResponse';

interface UseMetricsSeriesOptions<Fields> {
  fields: Fields;
  topN: number;
  yAxis: Fields;
  enabled?: boolean;
  interval?: string;
  overriddenRoute?: string;
  referrer?: string;
  samplingMode?: SamplingMode;
  search?: MutableSearch | string;
  sort?: Sort;
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
    | EAPSpanProperty[]
    | SpanMetricsProperty[]
    | SpanIndexedField[]
    | SpanFunctions[]
    | string[],
>(
  options: UseMetricsSeriesOptions<Fields>,
  referrer: string,
  pageFilters?: PageFilters
) => {
  return useTopNDiscoverSeries<Fields>(
    options,
    DiscoverDatasets.SPANS_EAP_RPC,
    referrer,
    pageFilters
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

  const sort = options.sort ?? eventView.sorts?.[0];

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
      orderby: sort ? encodeSort(sort) : undefined,
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

  const parsedData: DiscoverSeries[] = [];
  const parsedMeta: EventsMetaType = {fields: {}, units: {}};

  const seriesData = result.data ?? {};

  // Typically the response is an object, with the key being the series name and the value being the series data
  // However, if there is no series returned, the response is just single series object (and hence the 'data' key is present in the object)
  if (!seriesData?.data) {
    Object.keys(seriesData).forEach(seriesName => {
      const data = seriesData[seriesName]?.data ?? [];
      parsedData.push({
        seriesName,
        data: convertDiscoverTimeseriesResponse(data),
        meta: parsedMeta,
      });

      const meta = (seriesData[seriesName]?.meta ?? {}) as EventsMetaType;
      const yAxisField = yAxis[0];

      if (meta) {
        parsedMeta.fields = {
          ...parsedMeta.fields,
          ...meta.fields,
        };
        parsedMeta.units = {
          ...parsedMeta.units,
          ...meta.units,
        };
      }

      if (yAxisField) {
        if (meta.fields[yAxisField]) {
          parsedMeta.fields[seriesName] = meta.fields[yAxisField];
        }
        if (meta.units[yAxisField]) {
          parsedMeta.units[seriesName] = meta.units[yAxisField];
        }
      }
    });
  }

  return {...result, data: parsedData, meta: parsedMeta};
};
