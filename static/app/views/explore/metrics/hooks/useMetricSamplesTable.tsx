import {useCallback, useMemo} from 'react';
import moment from 'moment-timezone';

import type {PageFilters} from 'sentry/types/core';
import type {NewQuery} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {intervalToMilliseconds} from 'sentry/utils/duration/intervalToMilliseconds';
import usePageFilters from 'sentry/utils/usePageFilters';
import {formatSort} from 'sentry/views/explore/contexts/pageParamsContext/sortBys';
import type {RPCQueryExtras} from 'sentry/views/explore/hooks/useProgressiveQuery';
import {useProgressiveQuery} from 'sentry/views/explore/hooks/useProgressiveQuery';
import type {TraceMetric} from 'sentry/views/explore/metrics/metricQuery';
import {
  useQueryParamsQuery,
  useQueryParamsSortBys,
} from 'sentry/views/explore/queryParams/context';
import {
  DATE_FORMAT,
  useSpansQuery,
} from 'sentry/views/insights/common/queries/useSpansQuery';
import {INGESTION_DELAY} from 'sentry/views/insights/settings';

const MILLISECONDS_PER_SECOND = 1000;

interface UseMetricSamplesTableOptions {
  enabled: boolean;
  fields: string[];
  limit: number;
  traceMetric: TraceMetric;
  ingestionDelaySeconds?: number;
  queryExtras?: RPCQueryExtras;
}

interface MetricSamplesTableResult {
  eventView: EventView;
  fields: string[];
  result: ReturnType<typeof useSpansQuery<any[]>>;
}

export function useMetricSamplesTable({
  enabled,
  limit,
  traceMetric,
  fields,
  ingestionDelaySeconds,
  queryExtras,
}: UseMetricSamplesTableOptions) {
  const canTriggerHighAccuracy = useCallback(
    (result: ReturnType<typeof useMetricSamplesTableImpl>['result']) => {
      const canGoToHigherAccuracyTier = result.meta?.dataScanned === 'partial';
      const hasData = defined(result.data) && result.data.length > 0;
      return !hasData && canGoToHigherAccuracyTier;
    },
    []
  );

  return useProgressiveQuery<typeof useMetricSamplesTableImpl>({
    queryHookImplementation: useMetricSamplesTableImpl,
    queryHookArgs: {
      enabled,
      limit,
      traceMetric,
      fields,
      ingestionDelaySeconds,
      queryExtras: {
        ...queryExtras,
        traceMetric,
      },
    },
    queryOptions: {
      canTriggerHighAccuracy,
    },
  });
}

function useMetricSamplesTableImpl({
  enabled,
  limit,
  traceMetric,
  fields,
  ingestionDelaySeconds = INGESTION_DELAY,
  queryExtras,
}: UseMetricSamplesTableOptions): MetricSamplesTableResult {
  const {selection} = usePageFilters();
  const query = useQueryParamsQuery();
  const sortBys = useQueryParamsSortBys();

  // Calculate adjusted datetime values with ingestion delay applied
  // This is memoized separately to prevent recalculating on every render
  const adjustedDatetime: PageFilters['datetime'] = useMemo(() => {
    const {start, end, period, utc} = selection.datetime;

    // Only apply delay for relative time periods (statsPeriod), not absolute timestamps
    // because absolute timestamps are explicitly set by the user
    const periodMs = period ? intervalToMilliseconds(period) : 0;
    if (period && periodMs > ingestionDelaySeconds * MILLISECONDS_PER_SECOND && !end) {
      const startTime = moment().subtract(periodMs, 'milliseconds');
      const delayedEndTime = moment().subtract(ingestionDelaySeconds, 'seconds');

      return {
        start: startTime.format(DATE_FORMAT),
        end: delayedEndTime.format(DATE_FORMAT),
        period: null, // Clear period since we now have explicit timestamps
        utc,
      };
    }

    return {start, end, period, utc};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection.datetime.period, ingestionDelaySeconds]); // Only recalc when period or delay changes

  const eventView = useMemo(() => {
    const discoverQuery: NewQuery = {
      id: undefined,
      name: 'Explore - Metric Samples',
      fields,
      orderby: sortBys.map(formatSort),
      query,
      version: 2,
      dataset: DiscoverDatasets.TRACEMETRICS,
    };

    return EventView.fromNewQueryWithPageFilters(discoverQuery, {
      ...selection,
      datetime: adjustedDatetime,
    });
  }, [fields, query, selection, adjustedDatetime, sortBys]);

  const result = useSpansQuery({
    enabled: enabled && Boolean(traceMetric.name),
    eventView,
    initialData: [],
    limit,
    referrer: 'api.explore.metric-samples-table',
    trackResponseAnalytics: false,
    queryExtras,
  });

  return useMemo(() => {
    return {eventView, fields, result};
  }, [eventView, fields, result]);
}
