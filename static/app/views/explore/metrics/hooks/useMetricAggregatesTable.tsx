import {useCallback, useMemo} from 'react';

import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import type {NewQuery} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import {EventView} from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {formatSort} from 'sentry/views/explore/contexts/pageParamsContext/sortBys';
import {
  useProgressiveQuery,
  type RPCQueryExtras,
} from 'sentry/views/explore/hooks/useProgressiveQuery';
import type {TraceMetric} from 'sentry/views/explore/metrics/metricQuery';
import {
  useMetricVisualize,
  useMetricVisualizes,
} from 'sentry/views/explore/metrics/metricsQueryParams';
import {TraceMetricKnownFieldKey} from 'sentry/views/explore/metrics/types';
import {makeMetricsAggregate} from 'sentry/views/explore/metrics/utils';
import {
  useQueryParamsAggregateSortBys,
  useQueryParamsGroupBys,
  useQueryParamsQuery,
} from 'sentry/views/explore/queryParams/context';
import {isVisualizeEquation} from 'sentry/views/explore/queryParams/visualize';
import {useSpansQuery} from 'sentry/views/insights/common/queries/useSpansQuery';

interface UseMetricAggregatesTableOptions {
  enabled: boolean;
  limit: number;
  traceMetric: TraceMetric;
  queryExtras?: RPCQueryExtras;
  staleTime?: number;
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
  staleTime,
}: UseMetricAggregatesTableOptions) {
  const visualize = useMetricVisualize();
  const canTriggerHighAccuracy = useCallback(
    (result: ReturnType<typeof useMetricAggregatesTableImp>['result']) => {
      if (isVisualizeEquation(visualize)) {
        return false;
      }
      const countAggregate = makeCountAggregate(traceMetric);
      const canGoToHigherAccuracyTier = result.meta?.dataScanned === 'partial';
      const hasData =
        defined(result.data) &&
        (result.data.length > 1 ||
          (result.data.length === 1 && Boolean(result.data[0][countAggregate])));
      return !hasData && canGoToHigherAccuracyTier;
    },
    [traceMetric, visualize]
  );
  return useProgressiveQuery<typeof useMetricAggregatesTableImp>({
    queryHookImplementation: useMetricAggregatesTableImp,
    queryHookArgs: {
      enabled,
      limit,
      traceMetric,
      queryExtras,
      staleTime,
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
  staleTime,
}: UseMetricAggregatesTableOptions): MetricAggregatesTableResult {
  const {selection} = usePageFilters();
  const visualizes = useMetricVisualizes();

  const groupBys = useQueryParamsGroupBys();
  const query = useQueryParamsQuery();
  const sortBys = useQueryParamsAggregateSortBys();

  const isEquation = visualizes.every(isVisualizeEquation);

  const fields = useMemo(() => {
    const allFields: string[] = [];

    // Add group by fields first
    for (const groupBy of groupBys) {
      if (groupBy && !allFields.includes(groupBy)) {
        allFields.push(groupBy);
      }
    }

    // Add the yAxis aggregate
    for (const visualize of visualizes) {
      if (visualize.yAxis && !allFields.includes(visualize.yAxis)) {
        allFields.push(visualize.yAxis);
      }
    }

    return allFields.filter(Boolean);
  }, [groupBys, visualizes]);

  const eventView = useMemo(() => {
    const discoverQuery: NewQuery = {
      id: undefined,
      name: 'Explore - Application Metric Aggregates',
      fields: [...fields, ...(isEquation ? [] : [makeCountAggregate(traceMetric)])],
      orderby: sortBys.map(formatSort),
      query,
      version: 2,
      dataset: DiscoverDatasets.TRACEMETRICS,
    };

    return EventView.fromNewQueryWithPageFilters(discoverQuery, selection);
  }, [fields, query, selection, sortBys, traceMetric, isEquation]);

  const result = useSpansQuery({
    enabled:
      enabled &&
      fields.length > 0 &&
      (isEquation
        ? visualizes.every(
            visualize => isVisualizeEquation(visualize) && visualize.expression.text
          )
        : Boolean(traceMetric.name)),
    eventView,
    initialData: [],
    limit,
    referrer: 'api.explore.metric-aggregates-table',
    trackResponseAnalytics: false,
    queryExtras,
    staleTime,
  });

  return useMemo(() => {
    return {eventView, fields, result};
  }, [eventView, fields, result]);
}
