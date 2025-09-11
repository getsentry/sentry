import {useEffect, useState} from 'react';
import * as Sentry from '@sentry/react';
import isEqualWith from 'lodash/isEqualWith';

import {NODE_ENV} from 'sentry/constants';
import type {PageFilters} from 'sentry/types/core';
import type {Series} from 'sentry/types/echarts';
import {encodeSort, type EventsMetaType} from 'sentry/utils/discover/eventView';
import {
  useGenericDiscoverQuery,
  type DiscoverQueryProps,
} from 'sentry/utils/discover/genericDiscoverQuery';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {areNumbersAlmostEqual} from 'sentry/utils/number/areNumbersAlmostEqual';
import {useFetchEventsTimeSeries} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';
import type {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';
import type {SamplingMode} from 'sentry/views/explore/hooks/useProgressiveQuery';
import {getSeriesEventView} from 'sentry/views/insights/common/queries/getSeriesEventView';
import {DEFAULT_SAMPLING_MODE} from 'sentry/views/insights/common/queries/useDiscover';
import {convertSeriesToTimeseries} from 'sentry/views/insights/common/utils/convertSeriesToTimeseries';
import {
  getRetryDelay,
  shouldRetryHandler,
} from 'sentry/views/insights/common/utils/retryHandlers';
import type {SpanProperty} from 'sentry/views/insights/types';

import {convertDiscoverTimeseriesResponse} from './convertDiscoverTimeseriesResponse';

const {warn} = Sentry.logger;

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

/**
 * Fetch time series data from the `/events-stats/` endpoint. Consider using `useFetchEventsTimeSeries` instead, if you are able to. `useFetchEventsTimeSeries` uses the more modern `/events-timeseries/` API, which has a friendlier response format.
 */
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

  // Add a 10% sampled fetch of equivalent `/events-timeseries/` response so we
  // can compare the result and spot-check that there aren't any differences.
  const isTimeSeriesEndpointComparisonEnabled =
    useIsSampled(0.5) &&
    organization.features.includes('insights-events-time-series-spot-check');

  const eventsTimeSeriesResult = useFetchEventsTimeSeries(
    dataset,
    {
      query: search,
      yAxis: yAxis as SpanProperty[],
      interval,
      enabled: isTimeSeriesEndpointComparisonEnabled,
      sampling: samplingMode,
    },
    `${referrer}-time-series`
  );

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

  useEffect(() => {
    if (
      isTimeSeriesEndpointComparisonEnabled &&
      result.data &&
      !result.isFetching &&
      eventsTimeSeriesResult.data &&
      !eventsTimeSeriesResult.isFetching
    ) {
      const timeSeriesData = eventsTimeSeriesResult.data;
      const statsData = parsedData;

      for (const timeSeries of timeSeriesData.timeSeries) {
        const serie = statsData[timeSeries.yAxis as SpanProperty];

        if (!serie) {
          warn(
            `\`useDiscoverSeries\` Did not find corresponding series for "${timeSeries.yAxis}"`
          );
          return;
        }

        const converted = convertSeriesToTimeseries(serie);

        const stripped: TimeSeries = {
          ...timeSeries,
          values: timeSeries.values.map(item => ({
            timestamp: item.timestamp,
            value: item.value,
          })),
          meta: {
            valueType: timeSeries.meta.valueType,
            valueUnit: timeSeries.meta.valueUnit,
            interval: timeSeries.meta.interval,
          },
        };

        if (stripped.meta.valueUnit === undefined) {
          stripped.meta.valueUnit = null;
        }

        // Remove the first and last entry in both, since these are sensitive to items falling in/out of buckets between the two requests. Mutating the values is safe here, since these objects are only used for logging, and are not tied to the data that's returned.
        converted.values.shift();
        converted.values.pop();

        stripped.values.shift();
        stripped.values.pop();

        if (!isEqualWith(converted, stripped, comparator)) {
          warn(`\`useDiscoverSeries\` found a data difference in responses`, {
            yAxis,
            search: search
              ? typeof search === 'string'
                ? search
                : search.formatString()
              : undefined,
            referrer,
          });
          return;
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isTimeSeriesEndpointComparisonEnabled,
    result.data,
    result.isFetching,
    eventsTimeSeriesResult.data,
    eventsTimeSeriesResult.isFetching,
  ]);

  return {...result, data: parsedData as Record<T[number], DiscoverSeries>};
};

function comparator(
  valueA: unknown,
  valueB: unknown,
  key: symbol | string | number | undefined
) {
  // Compare numbers by near equality, which makes the comparison less sensitive to small natural variations in value caused by request sequencing
  if (key === 'value' && typeof valueA === 'number' && typeof valueB === 'number') {
    return areNumbersAlmostEqual(valueA, valueB, 7.5);
  }

  // Otherwise use default deep comparison
  return undefined;
}

function useIsSampled(rate: number) {
  const [isSampled, setIsSampled] = useState<boolean>(false);

  useEffect(() => {
    if (NODE_ENV !== 'test') {
      const rand = Math.random();
      setIsSampled(rand <= rate);
    }
  }, [rate]);

  return isSampled;
}
