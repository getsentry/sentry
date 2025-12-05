import {useMemo} from 'react';

import type {CaseInsensitive} from 'sentry/components/searchQueryBuilder/hooks';
import type {
  EventsStats,
  GroupedMultiSeriesEventsStats,
  MultiSeriesEventsStats,
} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import type {DataUnit} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {intervalToMilliseconds} from 'sentry/utils/duration/intervalToMilliseconds';
import {decodeSorts} from 'sentry/utils/queryString';
import {getTimeSeriesInterval} from 'sentry/utils/timeSeries/getTimeSeriesInterval';
import {markDelayedData} from 'sentry/utils/timeSeries/markDelayedData';
import {parseGroupBy} from 'sentry/utils/timeSeries/parseGroupBy';
import {useFetchEventsTimeSeries} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';
import type {MutableSearch} from 'sentry/utils/tokenizeSearch';
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

type SeriesMap = Record<string, TimeSeries[]>;

interface Options<Fields> {
  caseInsensitive?: CaseInsensitive;
  disableAggregateExtrapolation?: string;
  enabled?: boolean;
  fields?: string[];
  interval?: string;
  logQuery?: string[];
  metricQuery?: string[];
  orderby?: string | string[];
  referrer?: string;
  samplingMode?: SamplingMode;
  search?: MutableSearch;
  spanQuery?: string[];
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
  const {
    search,
    yAxis = [],
    interval,
    topEvents,
    fields,
    orderby,
    enabled,
    samplingMode,
    disableAggregateExtrapolation,
    caseInsensitive,
    logQuery,
    metricQuery,
    spanQuery,
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

  const groupBy = fields?.filter(
    field => !(yAxis as unknown as string[]).includes(field)
  );

  const result = useFetchEventsTimeSeries(
    dataset ?? DiscoverDatasets.SPANS,
    {
      yAxis: yAxis as unknown as any,
      query: search,
      topEvents,
      groupBy,
      pageFilters: pageFilters.selection,
      sort: decodeSorts(orderby)[0],
      caseInsensitive: Boolean(caseInsensitive),
      logQuery,
      metricQuery,
      spanQuery,
      interval,
      sampling: samplingMode,
      extrapolate: !disableAggregateExtrapolation,
      queryOptions: {
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
    },
    referrer
  );

  const data = useMemo(() => {
    return (
      result.data ? Object.groupBy(result.data.timeSeries, ts => ts.yAxis) : {}
    ) as SeriesMap;
  }, [result.data]);

  return {
    ...result,
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
