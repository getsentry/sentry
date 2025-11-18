import {useEffect, useEffectEvent, useMemo, useState} from 'react';
import * as Sentry from '@sentry/react';
import isEmpty from 'lodash/isEmpty';
import isEqualWith from 'lodash/isEqualWith';

import type {CaseInsensitive} from 'sentry/components/searchQueryBuilder/hooks';
import {NODE_ENV} from 'sentry/constants';
import type {
  EventsStats,
  GroupedMultiSeriesEventsStats,
  MultiSeriesEventsStats,
} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import {encodeSort} from 'sentry/utils/discover/eventView';
import type {DataUnit} from 'sentry/utils/discover/fields';
import {
  useGenericDiscoverQuery,
  type DiscoverQueryProps,
} from 'sentry/utils/discover/genericDiscoverQuery';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {intervalToMilliseconds} from 'sentry/utils/duration/intervalToMilliseconds';
import {areNumbersAlmostEqual} from 'sentry/utils/number/areNumbersAlmostEqual';
import {decodeSorts} from 'sentry/utils/queryString';
import {getTimeSeriesInterval} from 'sentry/utils/timeSeries/getTimeSeriesInterval';
import {markDelayedData} from 'sentry/utils/timeSeries/markDelayedData';
import {parseGroupBy} from 'sentry/utils/timeSeries/parseGroupBy';
import {useFetchEventsTimeSeries} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';
import type {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {
  isEventsStats,
  isGroupedMultiSeriesEventsStats,
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
import type {SpanFields, SpanFunctions} from 'sentry/views/insights/types';

const {warn} = Sentry.logger;

type SeriesMap = Record<string, TimeSeries[]>;

interface Options<Fields> {
  caseInsensitive?: CaseInsensitive;
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
  yAxis?: Fields;
}

export const useSortedTimeSeries = <
  Fields extends SpanFields[] | SpanFunctions[] | string[],
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
    samplingMode,
    disableAggregateExtrapolation,
    caseInsensitive,
  } = options;

  const pageFilters = usePageFilters();

  const eventView = getSeriesEventView(
    search,
    fields,
    pageFilters.selection,
    yAxis,
    topEvents,
    dataset ?? DiscoverDatasets.SPANS,
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

  // Add a sampled fetch of equivalent `/events-timeseries/` response so we can
  // compare the result and spot-check that there aren't any differences.

  // Re-roll the random value whenever the filters change
  const key = `${yAxis.join(',')}-${typeof search === 'string' ? search : search?.formatString()}-${topEvents}-${(fields ?? []).join(',')}-${pageFilters.selection.datetime.period}-${pageFilters.selection.datetime.start}-${pageFilters.selection.datetime.end}-${disableAggregateExtrapolation}`;

  const isTimeSeriesEndpointComparisonEnabled =
    useIsSampled(0.1, key) &&
    organization.features.includes('explore-events-time-series-spot-check');

  const groupBy = fields?.filter(
    field => !(yAxis as unknown as string[]).includes(field)
  );

  const timeSeriesResult = useFetchEventsTimeSeries(
    dataset ?? DiscoverDatasets.SPANS,
    {
      yAxis: yAxis as unknown as any,
      query: search,
      topEvents,
      groupBy,
      pageFilters: pageFilters.selection,
      sort: decodeSorts(orderby)[0],
      interval,
      sampling: samplingMode,
      extrapolate: !disableAggregateExtrapolation,
      enabled: isTimeSeriesEndpointComparisonEnabled,
    },
    `${referrer}-time-series`
  );

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
      // Timeseries requests do not support cursors, overwrite it to undefined so
      // pagination does not cause extra requests
      cursor: undefined,
      caseInsensitive,
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
    return isFetchingOrLoading ? {} : transformToSeriesMap(result.data, yAxis, fields);
  }, [isFetchingOrLoading, result.data, yAxis, fields]);

  const otherData = useMemo(() => {
    return timeSeriesResult.data
      ? Object.groupBy(timeSeriesResult.data.timeSeries, ts => ts.yAxis)
      : {};
  }, [timeSeriesResult.data]);

  // We don't want to re-run the comparison every time the `data` changes, since
  // `data` might be changed or mutated by the live reload functionality.
  // Instead, extract that into an effect event so it doesn't have a dependency
  // on `data`.
  const compareResponses = useEffectEvent(() => {
    if (!isEmpty(data) && !isEmpty(otherData)) {
      if (!isEqualWith(data, otherData, comparator)) {
        warn(`\`useDiscoverSeries\` found a data difference in responses`, {
          statsData: JSON.stringify(data),
          timeSeriesData: JSON.stringify(otherData),
        });
      }
    }
  });

  useEffect(() => {
    if (
      isTimeSeriesEndpointComparisonEnabled &&
      !result.isFetching &&
      !timeSeriesResult.isFetching
    ) {
      compareResponses();
    }
  }, [
    isTimeSeriesEndpointComparisonEnabled,
    result.isFetching,
    timeSeriesResult.isFetching,
  ]);

  const pageLinks = result.response?.getResponseHeader('Link') ?? undefined;

  return {
    ...result,
    pageLinks,
    data,
    meta: result.data?.meta,
  };
};

export function transformToSeriesMap(
  result: MultiSeriesEventsStats | GroupedMultiSeriesEventsStats | undefined,
  yAxis: string[],
  fields?: string[]
): SeriesMap {
  if (!result) {
    return {};
  }

  const allTimeSeries: TimeSeries[] = [];

  // Single series, applies to single axis queries. The yAxis is only knowable from the input data. There is no group
  const firstYAxis = yAxis[0] || '';
  if (isEventsStats(result)) {
    const [, timeSeries] = convertEventsStatsToTimeSeriesData(firstYAxis, result);
    allTimeSeries.push(timeSeries);
  }

  // Multiple series, applies to multi axis or topN events queries
  const hasMultipleYAxes = yAxis.length > 1;
  if (isMultiSeriesEventsStats(result)) {
    if (hasMultipleYAxes) {
      // This is a multi-axis query. The keys in the response are the yAxis
      // names, we can iterate the values. There is not grouping
      yAxis.forEach(axis => {
        const seriesData = result[axis]; // This is technically never `undefined` but better safe than sorry
        if (seriesData) {
          const [, timeSeries] = convertEventsStatsToTimeSeriesData(axis, seriesData);
          allTimeSeries.push(timeSeries);
        }
      });
    } else {
      // This is a top events query. The keys in the object will be the group names, and there is only one yAxis, known from the input
      Object.keys(result).forEach(groupName => {
        const seriesData = result[groupName]!;
        const [, timeSeries] = convertEventsStatsToTimeSeriesData(
          firstYAxis,
          seriesData,
          seriesData.order
        );

        if (fields) {
          const groupByFields = fields.filter(field => !yAxis.includes(field));
          const groupBy = parseGroupBy(groupName, groupByFields);
          timeSeries.groupBy = groupBy;
          timeSeries.meta.isOther = groupName === 'Other';
        }

        allTimeSeries.push(timeSeries);
      });
    }
  }

  // Multiple series, _and_ grouped. The top level keys are groups, the lower-level are the axes
  if (isGroupedMultiSeriesEventsStats(result)) {
    Object.keys(result).forEach(groupName => {
      const groupData = result[groupName] as MultiSeriesEventsStats;

      Object.keys(groupData).forEach(axis => {
        if (axis === 'order') {
          // `order` is a special key on grouped responses, we can skip over it
          return;
        }

        const seriesData = groupData[axis] as EventsStats;
        const [, timeSeries] = convertEventsStatsToTimeSeriesData(
          axis,
          seriesData,
          groupData.order as unknown as number // `order` is always present
        );

        if (fields) {
          const groupByFields = fields.filter(field => !yAxis.includes(field));
          const groupBy = parseGroupBy(groupName, groupByFields);
          timeSeries.groupBy = groupBy;
          timeSeries.meta.isOther = groupName === 'Other';
        }

        allTimeSeries.push(timeSeries);
      });
    });
  }

  return Object.groupBy(
    allTimeSeries.toSorted((a, b) => (a.meta.order ?? 0) - (b.meta.order ?? 0)),
    ts => ts.yAxis
  ) as SeriesMap;
}

export function convertEventsStatsToTimeSeriesData(
  yAxis: string,
  seriesData: EventsStats,
  order?: number
): [number, TimeSeries] {
  const values: TimeSeriesItem[] = seriesData.data.map(
    ([timestamp, countsForTimestamp], index) => {
      const item: TimeSeriesItem = {
        timestamp: timestamp * 1000,
        value: countsForTimestamp.reduce((acc, {count}) => acc + count, 0),
      };

      if (seriesData.meta?.accuracy) {
        const confidenceItem = seriesData.meta.accuracy.confidence?.[index];
        if (defined(confidenceItem) && Object.hasOwn(confidenceItem, 'value')) {
          item.confidence = confidenceItem.value;
        }

        const sampleCountItem = seriesData.meta.accuracy.sampleCount?.[index];
        if (defined(sampleCountItem) && Object.hasOwn(sampleCountItem, 'value')) {
          item.sampleCount = sampleCountItem.value;
        }

        const sampleRateItem = seriesData.meta.accuracy.samplingRate?.[index];
        if (defined(sampleRateItem) && Object.hasOwn(sampleRateItem, 'value')) {
          item.sampleRate = sampleRateItem.value;
        }
      }

      return item;
    }
  );

  const timeSeries: TimeSeries = {
    values,
    yAxis: yAxis ?? FALLBACK_SERIES_NAME,
    meta: {
      valueType: seriesData.meta?.fields?.[yAxis]!,
      valueUnit: seriesData.meta?.units?.[yAxis] as DataUnit,
      interval: getTimeSeriesInterval(values),
      dataScanned: seriesData.meta?.dataScanned,
    },
  };

  const delayedTimeSeries = markDelayedData(timeSeries, 90);

  if (defined(order)) {
    delayedTimeSeries.meta.order = order;
  }

  return [delayedTimeSeries.meta.order ?? 0, delayedTimeSeries];
}

const NUMERIC_KEYS: Array<symbol | string | number> = [
  'value',
  'sampleCount',
  'sampleRate',
];

function comparator(
  valueA: unknown,
  valueB: unknown,
  key: symbol | string | number | undefined,
  objA: Record<PropertyKey, unknown>,
  objB: Record<PropertyKey, unknown>
) {
  if (
    key &&
    NUMERIC_KEYS.includes(key) &&
    typeof valueA === 'number' &&
    typeof valueB === 'number' &&
    (objA?.incomplete || objB?.incomplete)
  ) {
    // Treat numerical values in incomplete buckets as equal, we don't care about the differences there
    return true;
  }

  if (
    key &&
    NUMERIC_KEYS.includes(key) &&
    typeof valueA === 'number' &&
    typeof valueB === 'number'
  ) {
    // Compare numbers by near equality, which makes the comparison less sensitive to small natural variations in value caused by request sequencing
    return areNumbersAlmostEqual(valueA, valueB, 5);
  }

  // This can be removed when ENG-5677 is resolved. There's a known bug here.
  if (key === 'dataScanned') {
    return true;
  }

  // Otherwise use default deep comparison
  return undefined;
}

function useIsSampled(rate: number, key = '') {
  const [isSampled, setIsSampled] = useState<boolean>(false);

  useEffect(() => {
    if (NODE_ENV !== 'test') {
      const rand = Math.random();
      setIsSampled(rand <= rate);
    }
  }, [rate, key]);

  return isSampled;
}
