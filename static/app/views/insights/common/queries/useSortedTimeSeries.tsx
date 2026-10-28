import {useMemo} from 'react';

import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import type {CaseInsensitive} from 'sentry/components/searchQueryBuilder/hooks';
import type {EventsStats} from 'sentry/types/organization';
import {defined} from 'sentry/utils/defined';
import type {DataUnit} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {intervalToMilliseconds} from 'sentry/utils/duration/intervalToMilliseconds';
import {decodeSorts} from 'sentry/utils/queryString';
import {getTimeSeriesInterval} from 'sentry/utils/timeSeries/getTimeSeriesInterval';
import {markDelayedData} from 'sentry/utils/timeSeries/markDelayedData';
import {useFetchEventsTimeSeries} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';
import type {AnyMutableSearch} from 'sentry/utils/url/formatSearchStringForQueryParam';
import type {
  TimeSeries,
  TimeSeriesItem,
} from 'sentry/views/dashboards/widgets/common/types';
import type {SamplingMode} from 'sentry/views/explore/hooks/useProgressiveQuery';
import {FALLBACK_SERIES_NAME} from 'sentry/views/explore/settings';
import {getSeriesEventView} from 'sentry/views/insights/common/queries/getSeriesEventView';
import {isEventViewEndInFuture} from 'sentry/views/insights/common/queries/useSpansQuery';
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
  samplingMode?: SamplingMode;
  search?: AnyMutableSearch;
  spanQuery?: string[];
  topEvents?: number;
  transformations?: ReadonlyArray<readonly string[]>;
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
    transformations,
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

  let staleTime = isEventViewEndInFuture(eventView) ? 0 : Infinity;
  if (
    usesRelativeDateRange &&
    defined(intervalInMilliseconds) &&
    intervalInMilliseconds !== 0
  ) {
    staleTime = intervalInMilliseconds;
  }

  const groupBy = fields?.filter(
    field => !(yAxis as unknown as string[]).includes(field)
  );

  const result = useFetchEventsTimeSeries(
    dataset ?? DiscoverDatasets.SPANS,
    {
      yAxis: yAxis as unknown as any,
      transformations,
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
        staleTime,
      },
    },
    referrer
  );

  const data = useMemo(() => {
    if (!result.data) {
      return {};
    }

    // Each response group repeats the requested axes in order, without an axis index.
    const series = transformations
      ? result.data.timeSeries.map((timeSeries, index) => ({
          ...timeSeries,
          requestedTransformations: transformations[index % yAxis.length] ?? [],
        }))
      : result.data.timeSeries;

    return Object.groupBy(series, ts => ts.yAxis) as SeriesMap;
  }, [result.data, transformations, yAxis]);

  return {
    ...result,
    data,
    meta: result.data?.meta,
  };
};

export type SortedTimeSeries = ReturnType<typeof useSortedTimeSeries>;

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
