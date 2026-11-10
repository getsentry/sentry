import {useMemo} from 'react';
import {useDebouncedValue} from '@tanstack/react-pacer';
import {useQuery} from '@tanstack/react-query';
import moment from 'moment-timezone';

import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {MutableSearch} from 'sentry/components/searchSyntax/mutableSearch';
import type {PageFilterDatetime} from 'sentry/types/core';
import type {
  AnomalyDataPoint,
  EventAnomalyPayload,
} from 'sentry/utils/anomalyDetection/anomalyDetectionPayload';
import {
  getAnomalyScoringPlan,
  type AnomalyScoringPlan,
} from 'sentry/utils/anomalyDetection/getAnomalyScoringPlan';
import {groupAnomaliesForBubbles} from 'sentry/utils/anomalyDetection/groupAnomaliesForBubbles';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {getUtcDateString} from 'sentry/utils/dates';
import {parseFunction} from 'sentry/utils/discover/fields';
import {fetchMutation} from 'sentry/utils/queryClient';
import {getTimeSeriesForQuery} from 'sentry/utils/timeSeries/getTimeSeriesForQuery';
import {useChartInterval} from 'sentry/utils/useChartInterval';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {Anomaly} from 'sentry/views/alerts/types';
import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';
import type {Visualize} from 'sentry/views/explore/queryParams/visualize';
import {useSpansDataset} from 'sentry/views/explore/spans/spansQueryParams';
import {useSortedTimeSeries} from 'sentry/views/insights/common/queries/useSortedTimeSeries';

import type {RPCQueryExtras} from './useProgressiveQuery';

/**
 * Seer and the endpoint need at least 7 days of history. Fetching one extra
 * day keeps bucket alignment and trimmed leading zeros from dropping the span
 * just under that.
 */
const HISTORY_BUFFER_DAYS = 1;

const DAY_MINUTES = 24 * 60;

/**
 * The date range fetched for anomaly detection: the part of the chart that's
 * scored, plus Seer's history limit (and a day) before it. Sizing it by the
 * scored part, not the whole chart, keeps long ranges from reaching past
 * retention. Relative ranges stay relative, absolute ranges reach back from
 * their end date.
 */
export function getAnomalyFetchDatetime(
  datetime: PageFilterDatetime,
  plan: AnomalyScoringPlan
): PageFilterDatetime {
  const minutes =
    plan.scoredMinutes + (plan.historyDays + HISTORY_BUFFER_DAYS) * DAY_MINUTES;

  if (datetime.start && datetime.end) {
    const end = moment.utc(datetime.end);
    return {
      period: null,
      start: getUtcDateString(end.clone().subtract(minutes, 'minutes')),
      end: getUtcDateString(end),
      utc: true,
    };
  }

  return {period: `${minutes}m`, start: null, end: null, utc: datetime.utc};
}

/**
 * Splits the fetched series into the history and the part of the chart that's
 * scored, which is its last `plan.scoredMinutes`.
 */
export function splitAnomalyDataPoints(
  points: AnomalyDataPoint[],
  plan: AnomalyScoringPlan
): {currentData: AnomalyDataPoint[]; historicalData: AnomalyDataPoint[]} {
  const scoredCount = Math.max(1, Math.floor(plan.scoredMinutes / plan.intervalMinutes));
  const splitIndex = Math.max(0, points.length - scoredCount);
  return {
    currentData: points.slice(splitIndex),
    historicalData: points.slice(0, splitIndex),
  };
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
 * Re-runs the chart's query at an interval Seer accepts, over the scored part
 * of the chart plus its history, and asks Seer which points are anomalous.
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

  const plan = useMemo(
    () => getAnomalyScoringPlan(selection.datetime, interval),
    [selection.datetime, interval]
  );
  const fetchDatetime = useMemo(
    () => getAnomalyFetchDatetime(selection.datetime, plan),
    [selection.datetime, plan]
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
      interval: plan.interval,
      datetime: fetchDatetime,
      enabled: enabled && isMainChartLoaded,
      disableAggregateExtrapolation: extrapolate ? undefined : '1',
      ...queryExtras,
    }),
    [
      enabled,
      extrapolate,
      fetchDatetime,
      isMainChartLoaded,
      plan.interval,
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

  const fetchedTimeSeries = useMemo(
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

  const {currentData, historicalData} = useMemo(
    () => splitAnomalyDataPoints(timeSeriesToAnomalyDataPoints(fetchedTimeSeries), plan),
    [fetchedTimeSeries, plan]
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
          time_period: plan.intervalMinutes,
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
  // Each period covers its anomalous buckets in full, so it lines up on charts
  // with finer or coarser buckets than the scoring interval.
  const anomalyPeriods = useMemo(() => {
    if (!anomalies) {
      return [];
    }
    const bucketMs = plan.intervalMinutes * 60_000;
    return groupAnomaliesForBubbles(anomalies).map(period => ({
      ...period,
      end: period.end + bucketMs,
    }));
  }, [anomalies, plan.intervalMinutes]);

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
  } else if (isMainChartLoaded && !historyResult.isPending) {
    if (currentData.length === 0) {
      // Nothing on the chart to score
      status = 'idle';
    } else if (historicalData.length === 0) {
      status = 'empty';
    }
  }

  return {
    anomalies,
    anomalyPeriods,
    error,
    fetchDatetime,
    plan,
    status,
  };
}
