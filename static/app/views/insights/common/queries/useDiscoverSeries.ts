import moment from 'moment-timezone';

import type {Series} from 'sentry/types/echarts';
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
import {getSeriesEventView} from 'sentry/views/insights/common/queries/getSeriesEventView';
import {
  getRetryDelay,
  shouldRetryHandler,
} from 'sentry/views/insights/common/utils/retryHandlers';
import type {
  MetricsProperty,
  SpanFunctions,
  SpanIndexedField,
  SpanMetricsProperty,
} from 'sentry/views/insights/types';

import {DATE_FORMAT} from './useSpansQuery';

export interface MetricTimeseriesRow {
  [key: string]: number;
  interval: number;
}

type DiscoverSeries = Series & {
  meta?: EventsMetaType;
};

interface UseMetricsSeriesOptions<Fields> {
  enabled?: boolean;
  interval?: string;
  overriddenRoute?: string;
  referrer?: string;
  search?: MutableSearch;
  yAxis?: Fields;
}

export const useSpanMetricsSeries = <Fields extends SpanMetricsProperty[]>(
  options: UseMetricsSeriesOptions<Fields> = {},
  referrer: string
) => {
  return useDiscoverSeries<Fields>(options, DiscoverDatasets.SPANS_METRICS, referrer);
};

export const useMetricsSeries = <Fields extends MetricsProperty[]>(
  options: UseMetricsSeriesOptions<Fields> = {},
  referrer: string
) => {
  return useDiscoverSeries<Fields>(options, DiscoverDatasets.METRICS, referrer);
};

/**
 * TODO: Remove string type, added to fix types for 'count()'
 */
export const useSpanIndexedSeries = <
  Fields extends SpanIndexedField[] | SpanFunctions[] | string[],
>(
  options: UseMetricsSeriesOptions<Fields> = {},
  referrer: string,
  dataset?: DiscoverDatasets
) => {
  return useDiscoverSeries<Fields>(
    options,
    dataset ?? DiscoverDatasets.SPANS_INDEXED,
    referrer
  );
};

const useDiscoverSeries = <T extends string[]>(
  options: UseMetricsSeriesOptions<T> = {},
  dataset: DiscoverDatasets,
  referrer: string
) => {
  const {search = undefined, yAxis = [], interval = undefined} = options;

  const pageFilters = usePageFilters();
  const location = useLocation();
  const organization = useOrganization();

  const eventView = getSeriesEventView(
    search,
    undefined,
    pageFilters.selection,
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
    }),
    options: {
      enabled: options.enabled && pageFilters.isReady,
      refetchOnWindowFocus: false,
      retry: shouldRetryHandler,
      retryDelay: getRetryDelay,
      staleTime: Infinity,
    },
    referrer,
  });

  const parsedData: Record<string, DiscoverSeries> = {};

  yAxis.forEach(seriesName => {
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

function convertDiscoverTimeseriesResponse(data: any[]): DiscoverSeries['data'] {
  return data.map(([timestamp, [{count: value}]]) => {
    return {
      name: moment(parseInt(timestamp, 10) * 1000).format(DATE_FORMAT),
      value,
    };
  });
}
