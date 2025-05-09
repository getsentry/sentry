import {useMemo} from 'react';

import type {
  EventsStats,
  GroupedMultiSeriesEventsStats,
  MultiSeriesEventsStats,
} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import {encodeSort} from 'sentry/utils/discover/eventView';
import type {DataUnit} from 'sentry/utils/discover/fields';
import {
  type DiscoverQueryProps,
  useGenericDiscoverQuery,
} from 'sentry/utils/discover/genericDiscoverQuery';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {intervalToMilliseconds} from 'sentry/utils/duration/intervalToMilliseconds';
import {getTimeSeriesInterval} from 'sentry/utils/timeSeries/getTimeSeriesInterval';
import type {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {determineSeriesConfidence} from 'sentry/views/alerts/rules/metric/utils/determineSeriesConfidence';
import {
  isEventsStats,
  isMultiSeriesEventsStats,
} from 'sentry/views/dashboards/utils/isEventsStats';
import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';
import type {SamplingMode} from 'sentry/views/explore/hooks/useProgressiveQuery';
import {FALLBACK_SERIES_NAME} from 'sentry/views/explore/settings';
import {getSeriesEventView} from 'sentry/views/insights/common/queries/getSeriesEventView';
import {
  getRetryDelay,
  shouldRetryHandler,
} from 'sentry/views/insights/common/utils/retryHandlers';
import type {SpanFunctions, SpanIndexedField} from 'sentry/views/insights/types';

type SeriesMap = Record<string, TimeSeries[]>;

interface Options<Fields> {
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
  Fields extends SpanIndexedField[] | SpanFunctions[] | string[],
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
  } = options;

  const pageFilters = usePageFilters();

  const eventView = getSeriesEventView(
    search,
    fields,
    pageFilters.selection,
    yAxis,
    topEvents,
    dataset ?? DiscoverDatasets.SPANS_INDEXED,
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
      // Timeseries requests do not support cursors, overwrite it to undefined so
      // pagination does not cause extra requests
      cursor: undefined,
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
    return isFetchingOrLoading ? {} : transformToSeriesMap(result.data, yAxis);
  }, [isFetchingOrLoading, result.data, yAxis]);

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
  yAxis: string[]
): SeriesMap {
  if (!result) {
    return {};
  }

  // Single series, applies to single axis queries
  const firstYAxis = yAxis[0] || '';
  if (isEventsStats(result)) {
    const [, series] = convertEventsStatsToTimeSeriesData(firstYAxis, result);
    return {
      [firstYAxis]: [series],
    };
  }

  // Multiple series, applies to multi axis or topN events queries
  const hasMultipleYAxes = yAxis.length > 1;
  if (isMultiSeriesEventsStats(result)) {
    const processedResults: Array<[number, TimeSeries]> = Object.keys(result).map(
      seriesOrGroupName => {
        // If this is a single-axis top N result, the keys in the response are
        // group names. The field name is the first (and only) Y axis. If it's a
        // multi-axis non-top-N result, the keys are the axis names. Figure out
        // the field name and the group name (if different) and format accordingly
        return convertEventsStatsToTimeSeriesData(
          hasMultipleYAxes ? seriesOrGroupName : yAxis[0]!,
          result[seriesOrGroupName]!,
          hasMultipleYAxes ? undefined : seriesOrGroupName,
          hasMultipleYAxes ? undefined : result[seriesOrGroupName]!.order
        );
      }
    );

    if (!hasMultipleYAxes) {
      return {
        [firstYAxis]: processedResults
          .sort(([a], [b]) => a - b)
          .map(([, series]) => series),
      };
    }

    return processedResults
      .sort(([a], [b]) => a - b)
      .reduce((acc, [, series]) => {
        acc[series.yAxis] = [series];
        return acc;
      }, {} as SeriesMap);
  }

  // Grouped multi series, applies to topN events queries with multiple y-axes
  // First, we process the grouped multi series into a list of [seriesName, order, {[aggFunctionAlias]: EventsStats}]
  // to enable sorting.
  const processedResults: Array<[string, number, MultiSeriesEventsStats]> = [];
  Object.keys(result).forEach(groupName => {
    const {order: groupOrder, ...groupData} = result[groupName]!;
    processedResults.push([
      groupName,
      groupOrder || 0,
      groupData as MultiSeriesEventsStats,
    ]);
  });

  return processedResults
    .sort(([, orderA], [, orderB]) => orderA - orderB)
    .reduce((acc, [groupName, groupOrder, groupData]) => {
      Object.keys(groupData).forEach(seriesName => {
        const [, series] = convertEventsStatsToTimeSeriesData(
          seriesName,
          groupData[seriesName]!,
          groupName,
          groupOrder
        );

        if (acc[seriesName]) {
          acc[seriesName].push(series);
        } else {
          acc[seriesName] = [series];
        }
      });
      return acc;
    }, {} as SeriesMap);
}

export function convertEventsStatsToTimeSeriesData(
  seriesName: string,
  seriesData: EventsStats,
  alias?: string,
  order?: number
): [number, TimeSeries] {
  const label = alias ?? (seriesName || FALLBACK_SERIES_NAME);

  const values = seriesData.data.map(([timestamp, countsForTimestamp]) => ({
    timestamp: timestamp * 1000,
    value: countsForTimestamp.reduce((acc, {count}) => acc + count, 0),
  }));

  const interval = getTimeSeriesInterval(values);

  const serie: TimeSeries = {
    yAxis: label,
    values,
    meta: {
      valueType: seriesData.meta?.fields?.[seriesName]!,
      valueUnit: seriesData.meta?.units?.[seriesName] as DataUnit,
      interval,
    },
    confidence: determineSeriesConfidence(seriesData),
    sampleCount: seriesData.meta?.accuracy?.sampleCount,
    samplingRate: seriesData.meta?.accuracy?.samplingRate,
    dataScanned: seriesData.meta?.dataScanned,
  };

  if (defined(order)) {
    serie.meta.order = order;
  }

  return [seriesData.order ?? 0, serie];
}
