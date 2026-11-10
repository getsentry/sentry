import {useMemo} from 'react';
import {useDebouncedValue} from '@tanstack/react-pacer';
import {useQuery} from '@tanstack/react-query';
import moment from 'moment-timezone';

import {getDiffInMinutes} from 'sentry/components/charts/utils';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {MutableSearch} from 'sentry/components/searchSyntax/mutableSearch';
import type {PageFilterDatetime} from 'sentry/types/core';
import {
  removeOverlappingHistoricalData,
  type AnomalyDataPoint,
  type EventAnomalyPayload,
} from 'sentry/utils/anomalyDetection/anomalyDetectionPayload';
import {groupAnomaliesForBubbles} from 'sentry/utils/anomalyDetection/groupAnomaliesForBubbles';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {getUtcDateString} from 'sentry/utils/dates';
import {parseFunction} from 'sentry/utils/discover/fields';
import {intervalToMilliseconds} from 'sentry/utils/duration/intervalToMilliseconds';
import {fetchMutation} from 'sentry/utils/queryClient';
import {getTimeSeriesForQuery} from 'sentry/utils/timeSeries/getTimeSeriesForQuery';
import {useChartInterval} from 'sentry/utils/useChartInterval';
import {useOrganization} from 'sentry/utils/useOrganization';
import {TimePeriod} from 'sentry/views/alerts/rules/metric/types';
import {AnomalyType, type Anomaly} from 'sentry/views/alerts/types';
import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';
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

/**
 * - `idle`: anomalies are off, or there's nothing to score
 * - `loading`: waiting for the chart, the history or Seer
 * - `empty`: there isn't enough history to score against
 * - `error`: the history or the Seer call failed
 * - `ready`: the chart was scored; `anomalyPeriods` may still be empty
 */
export type ExploreAnomaliesStatus = 'idle' | 'loading' | 'empty' | 'error' | 'ready';

/**
 * How long the chart's query, interval and range must stay unchanged before
 * Seer is called, so rapid edits don't each trigger a request.
 */
export const SETTLE_WAIT_MS = 1000;

/**
 * Converts Explore time series into the endpoint's data points. Incomplete
 * buckets (e.g. the one still filling up) are dropped so a partial bucket isn't
 * flagged as a drop.
 */
export function timeSeriesToAnomalyDataPoints(
  timeSeries: readonly TimeSeries[]
): AnomalyDataPoint[] {
  const values = timeSeries[0]?.values ?? [];
  return values
    .filter(item => !item.incomplete)
    .map((item): AnomalyDataPoint => [item.timestamp / 1000, {count: item.value ?? 0}])
    .sort(([a], [b]) => a - b);
}

/**
 * Lets Seer apply its static threshold to count metrics
 */
export function getAnomalyAggregate(yAxis: string): 'count' | 'other' {
  return parseFunction(yAxis)?.name === 'count' ? 'count' : 'other';
}

interface UseExploreAnomaliesOptions {
  /**
   * The main chart's series for this visualize
   */
  currentTimeSeries: readonly TimeSeries[];
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
 * Fetches a historical baseline for the chart and asks Seer which points in
 * the chart's series are anomalous.
 */
export function useExploreAnomalies({
  currentTimeSeries,
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

  const historyOptions = useMemo(
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

  const historyResult = useSortedTimeSeries(
    historyOptions,
    `api.explore.${dataset}-anomaly-history`,
    dataset
  );

  const historicalTimeSeries = useMemo(
    () => getTimeSeriesForQuery(historyResult.data, visualize.yAxis, transformations),
    [historyResult.data, visualize.yAxis, transformations]
  );

  const projectId = String(selection.projects[0] ?? '');

  // Everything that changes which anomalies Seer would return. The result is
  // cached under this key for the rest of the session.
  const cacheKey = useMemo(
    () =>
      JSON.stringify({
        projectId,
        query,
        queryExtras,
        extrapolate,
        yAxis: visualize.yAxis,
        transformations,
        interval,
        datetime: selection.datetime,
        environments: selection.environments,
      }),
    [
      extrapolate,
      interval,
      projectId,
      query,
      queryExtras,
      selection.datetime,
      selection.environments,
      transformations,
      visualize.yAxis,
    ]
  );
  const [settledCacheKey] = useDebouncedValue(cacheKey, {wait: SETTLE_WAIT_MS});
  const isSettled = settledCacheKey === cacheKey;

  const currentData = useMemo(
    () => timeSeriesToAnomalyDataPoints(currentTimeSeries),
    [currentTimeSeries]
  );
  const historicalData = useMemo(
    () =>
      removeOverlappingHistoricalData(
        currentData,
        timeSeriesToAnomalyDataPoints(historicalTimeSeries)
      ),
    [currentData, historicalTimeSeries]
  );

  const canDetect =
    enabled &&
    isMainChartLoaded &&
    isSettled &&
    !historyResult.isPending &&
    currentData.length > 0 &&
    historicalData.length > 0;

  // Keyed by the chart's query, interval and range (`cacheKey`), not by the
  // series it sends, so a refetched or refined series reuses the result.
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  const anomaliesResult = useQuery({
    queryKey: ['explore-anomalies', organization.slug, cacheKey],
    queryFn: () => {
      const payload: EventAnomalyPayload = {
        organization_id: organization.id,
        project_id: projectId,
        config: {
          direction: 'both',
          sensitivity: 'medium',
          expected_seasonality: 'auto',
          time_period: intervalToMilliseconds(interval) / 1000 / 60,
          aggregate: getAnomalyAggregate(visualize.yAxis),
        },
        current_data: currentData,
        historical_data: historicalData,
      };
      return fetchMutation<Anomaly[]>({
        url: getApiUrl('/organizations/$organizationIdOrSlug/events/anomalies/', {
          path: {organizationIdOrSlug: organization.slug},
        }),
        method: 'POST',
        data: payload,
      });
    },
    staleTime: Infinity,
    retry: false,
    enabled: canDetect,
  });

  // A disabled query still returns its cached data, so drop it when
  // anomalies are turned off, or the chart would keep the old markers.
  const anomalies = enabled ? anomaliesResult.data : undefined;
  const anomalyPeriods = useMemo(
    () =>
      anomalies
        ? groupAnomaliesForBubbles(anomalies, intervalToMilliseconds(interval))
        : [],
    [anomalies, interval]
  );

  const anomalousTimestamps = useMemo(
    () =>
      new Set(
        (anomalies ?? [])
          .filter(
            anomaly =>
              anomaly.anomaly.anomaly_type === AnomalyType.HIGH_CONFIDENCE ||
              anomaly.anomaly.anomaly_type === AnomalyType.LOW_CONFIDENCE
          )
          .map(anomaly => anomaly.timestamp * 1000)
      ),
    [anomalies]
  );

  const error = enabled ? (historyResult.error ?? anomaliesResult.error) : null;

  let status: ExploreAnomaliesStatus = 'loading';
  if (!enabled) {
    status = 'idle';
  } else if (anomalies) {
    // The endpoint returns every scored point, or nothing when the history is
    // too short to score against.
    status = anomalies.length > 0 ? 'ready' : 'empty';
  } else if (error) {
    status = 'error';
  } else if (isMainChartLoaded && currentData.length === 0) {
    // Nothing on the chart to score
    status = 'idle';
  } else if (
    isMainChartLoaded &&
    !historyResult.isPending &&
    historicalData.length === 0
  ) {
    status = 'empty';
  }

  return {
    anomalies,
    anomalousTimestamps,
    anomalyPeriods,
    error,
    historicalDatetime,
    historicalTimeSeries,
    status,
  };
}
