import {useMemo} from 'react';
import moment from 'moment-timezone';

import {getDiffInMinutes} from 'sentry/components/charts/utils';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {MutableSearch} from 'sentry/components/searchSyntax/mutableSearch';
import type {PageFilterDatetime} from 'sentry/types/core';
import {getUtcDateString} from 'sentry/utils/dates';
import {intervalToMilliseconds} from 'sentry/utils/duration/intervalToMilliseconds';
import {getTimeSeriesForQuery} from 'sentry/utils/timeSeries/getTimeSeriesForQuery';
import {useChartInterval} from 'sentry/utils/useChartInterval';
import {useOrganization} from 'sentry/utils/useOrganization';
import {TimePeriod} from 'sentry/views/alerts/rules/metric/types';
import {EAP_HISTORICAL_TIME_PERIOD_MAP} from 'sentry/views/detectors/utils/timePeriods';
import type {Visualize} from 'sentry/views/explore/queryParams/visualize';
import {useSpansDataset} from 'sentry/views/explore/spans/spansQueryParams';
import {useSortedTimeSeries} from 'sentry/views/insights/common/queries/useSortedTimeSeries';

import type {RPCQueryExtras} from './useProgressiveQuery';

/**
 * Picks the smallest monitor time period that covers the chart's range. Ranges
 * longer than 7 days are rejected before this runs.
 */
function getMonitorTimePeriod(datetime: PageFilterDatetime) {
  const minutes = getDiffInMinutes(datetime);
  if (minutes <= 6 * 60) {
    return TimePeriod.SIX_HOURS;
  }
  if (minutes <= 24 * 60) {
    return TimePeriod.ONE_DAY;
  }
  if (minutes <= 3 * 24 * 60) {
    return TimePeriod.THREE_DAYS;
  }
  return TimePeriod.SEVEN_DAYS;
}

/**
 * The date range used as the anomaly detection baseline: about 28–31 days that
 * end where the chart ends. Relative ranges stay relative, absolute ranges
 * reach back from their end date.
 */
export function getHistoricalDatetime(datetime: PageFilterDatetime): PageFilterDatetime {
  const period =
    EAP_HISTORICAL_TIME_PERIOD_MAP[
      getMonitorTimePeriod(datetime) as keyof typeof EAP_HISTORICAL_TIME_PERIOD_MAP
    ];

  if (datetime.start && datetime.end) {
    const end = moment.utc(datetime.end);
    return {
      period: null,
      start: getUtcDateString(end.clone().subtract(intervalToMilliseconds(period), 'ms')),
      end: getUtcDateString(end),
      utc: true,
    };
  }

  return {period, start: null, end: null, utc: datetime.utc};
}

interface UseExploreAnomaliesOptions {
  /**
   * Whether anomalies are on and allowed for this chart
   */
  enabled: boolean;
  extrapolate: boolean;
  /**
   * Whether the main chart's series has finished loading
   */
  isMainChartLoaded: boolean;
  query: string;
  visualize: Visualize;
  queryExtras?: RPCQueryExtras;
}

/**
 * Fetches the historical series that anomaly detection compares the chart
 * against. It re-runs the chart's query without a group by over a longer range.
 */
export function useExploreAnomalies({
  enabled,
  extrapolate,
  isMainChartLoaded,
  query,
  queryExtras,
  visualize,
}: UseExploreAnomaliesOptions) {
  const organization = useOrganization();
  const transformationsEnabled = organization.features.includes(
    'explore-interpolation-and-smoothing'
  );
  const dataset = useSpansDataset();
  const {selection} = usePageFilters();
  const [interval] = useChartInterval();

  const historicalDatetime = useMemo(
    () => getHistoricalDatetime(selection.datetime),
    [selection.datetime]
  );

  const transformations = useMemo(
    () => (transformationsEnabled ? visualize.transformations : []),
    [transformationsEnabled, visualize.transformations]
  );

  const options = useMemo(
    () => ({
      search: new MutableSearch(query),
      yAxis: [visualize.yAxis],
      fields: [visualize.yAxis],
      transformations: transformationsEnabled ? [transformations] : undefined,
      interval,
      datetime: historicalDatetime,
      enabled: enabled && isMainChartLoaded,
      disableAggregateExtrapolation: extrapolate ? undefined : '1',
      ...queryExtras,
    }),
    [
      enabled,
      extrapolate,
      historicalDatetime,
      interval,
      isMainChartLoaded,
      query,
      queryExtras,
      transformations,
      transformationsEnabled,
      visualize.yAxis,
    ]
  );

  const result = useSortedTimeSeries(
    options,
    `api.explore.${dataset}-anomaly-history`,
    dataset
  );

  const historicalTimeSeries = useMemo(
    () => getTimeSeriesForQuery(result.data, visualize.yAxis, transformations),
    [result.data, visualize.yAxis, transformations]
  );

  return {
    historicalTimeSeries,
    historicalDatetime,
    isLoading: result.isLoading,
    error: result.error,
  };
}
