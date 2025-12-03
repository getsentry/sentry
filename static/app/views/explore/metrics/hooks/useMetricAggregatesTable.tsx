import {useCallback, useMemo} from 'react';

import type {NewQuery} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import usePageFilters from 'sentry/utils/usePageFilters';
import {formatSort} from 'sentry/views/explore/contexts/pageParamsContext/sortBys';
import {
  useProgressiveQuery,
  type RPCQueryExtras,
} from 'sentry/views/explore/hooks/useProgressiveQuery';
import type {TraceMetric} from 'sentry/views/explore/metrics/metricQuery';
import {useMetricVisualize} from 'sentry/views/explore/metrics/metricsQueryParams';
import {TraceMetricKnownFieldKey} from 'sentry/views/explore/metrics/types';
import {makeMetricsAggregate} from 'sentry/views/explore/metrics/utils';
import {
  useQueryParamsAggregateSortBys,
  useQueryParamsGroupBys,
  useQueryParamsQuery,
} from 'sentry/views/explore/queryParams/context';
import {useSpansQuery} from 'sentry/views/insights/common/queries/useSpansQuery';

interface UseMetricAggregatesTableOptions {
  enabled: boolean;
  limit: number;
  traceMetric: TraceMetric;
  queryExtras?: RPCQueryExtras;
}

interface MetricAggregatesTableResult {
  eventView: EventView;
  fields: string[];
  result: ReturnType<typeof useSpansQuery<any[]>>;
}

function makeCountAggregate(traceMetric: TraceMetric): string {
  return makeMetricsAggregate({
    aggregate: 'count',
    traceMetric,
    attribute: TraceMetricKnownFieldKey.METRIC_NAME,
  });
}

export function useMetricAggregatesTable({
  enabled,
  limit,
  traceMetric,
  queryExtras,
}: UseMetricAggregatesTableOptions) {
  const canTriggerHighAccuracy = useCallback(
    (result: ReturnType<typeof useMetricAggregatesTableImp>['result']) => {
      const countAggregate = makeCountAggregate(traceMetric);
      const canGoToHigherAccuracyTier = result.meta?.dataScanned === 'partial';
      const hasData =
        defined(result.data) &&
        (result.data.length > 1 ||
          (result.data.length === 1 && Boolean(result.data[0][countAggregate])));
      return !hasData && canGoToHigherAccuracyTier;
    },
    [traceMetric]
  );
  return useProgressiveQuery<typeof useMetricAggregatesTableImp>({
    queryHookImplementation: useMetricAggregatesTableImp,
    queryHookArgs: {
      enabled,
      limit,
      traceMetric,
      queryExtras,
    },
    queryOptions: {
      canTriggerHighAccuracy,
    },
  });
}

function useMetricAggregatesTableImp({
  enabled,
  limit,
  traceMetric,
  queryExtras,
}: UseMetricAggregatesTableOptions): MetricAggregatesTableResult {
  const {selection} = usePageFilters();
  const visualize = useMetricVisualize();
  const groupBys = useQueryParamsGroupBys();
  const query = useQueryParamsQuery();
  const sortBys = useQueryParamsAggregateSortBys();

  const fields = useMemo(() => {
    const allFields: string[] = [];

    // Add group by fields first
    for (const groupBy of groupBys) {
      if (groupBy && !allFields.includes(groupBy)) {
        allFields.push(groupBy);
      }
    }

    // Add the yAxis aggregate
    if (visualize.yAxis && !allFields.includes(visualize.yAxis)) {
      allFields.push(visualize.yAxis);
    }

    return allFields.filter(Boolean);
  }, [groupBys, visualize.yAxis]);

  const eventView = useMemo(() => {
    const discoverQuery: NewQuery = {
      id: undefined,
      name: 'Explore - Metric Aggregates',
      fields: [...fields, makeCountAggregate(traceMetric)],
      orderby: sortBys.map(formatSort),
      query,
      version: 2,
      dataset: DiscoverDatasets.TRACEMETRICS,
    };

    return EventView.fromNewQueryWithPageFilters(discoverQuery, selection);
  }, [fields, query, selection, sortBys, traceMetric]);

  const result = useSpansQuery({
    enabled: enabled && Boolean(traceMetric.name) && fields.length > 0,
    eventView,
    initialData: [],
    limit,
    referrer: 'api.explore.metric-aggregates-table',
    trackResponseAnalytics: false,
    queryExtras,
  });

  return useMemo(() => {
    return {eventView, fields, result};
  }, [eventView, fields, result]);
}
