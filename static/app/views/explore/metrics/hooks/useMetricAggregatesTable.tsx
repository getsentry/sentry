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
import {useMetricVisualize} from 'sentry/views/explore/metrics/metricsQueryParams';
import {
  useQueryParamsAggregateSortBys,
  useQueryParamsGroupBys,
  useQueryParamsSearch,
} from 'sentry/views/explore/queryParams/context';
import {useSpansQuery} from 'sentry/views/insights/common/queries/useSpansQuery';

interface UseMetricAggregatesTableOptions {
  enabled: boolean;
  limit: number;
  metricName: string;
  queryExtras?: RPCQueryExtras;
}

interface MetricAggregatesTableResult {
  eventView: EventView;
  fields: string[];
  result: ReturnType<typeof useSpansQuery<any[]>>;
}

export function useMetricAggregatesTable({
  enabled,
  limit,
  metricName,
  queryExtras,
}: UseMetricAggregatesTableOptions) {
  const canTriggerHighAccuracy = useCallback(
    (result: ReturnType<typeof useMetricAggregatesTableImp>['result']) => {
      const canGoToHigherAccuracyTier = result.meta?.dataScanned === 'partial';
      const hasData = defined(result.data) && result.data.length > 0;
      return !hasData && canGoToHigherAccuracyTier;
    },
    []
  );
  return useProgressiveQuery<typeof useMetricAggregatesTableImp>({
    queryHookImplementation: useMetricAggregatesTableImp,
    queryHookArgs: {enabled, limit, metricName, queryExtras},
    queryOptions: {
      canTriggerHighAccuracy,
    },
  });
}

function useMetricAggregatesTableImp({
  enabled,
  limit,
  metricName,
  queryExtras,
}: UseMetricAggregatesTableOptions): MetricAggregatesTableResult {
  const {selection} = usePageFilters();
  const visualize = useMetricVisualize();
  const groupBys = useQueryParamsGroupBys();
  const searchQuery = useQueryParamsSearch();
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

  const query = useMemo(() => {
    const baseQuery = `metric.name:${metricName}`;
    if (!searchQuery.isEmpty()) {
      return `${baseQuery} (${searchQuery.formatString()})`;
    }
    return baseQuery;
  }, [metricName, searchQuery]);

  const eventView = useMemo(() => {
    const discoverQuery: NewQuery = {
      id: undefined,
      name: 'Explore - Metric Aggregates',
      fields,
      orderby: sortBys.map(formatSort),
      query,
      version: 2,
      dataset: DiscoverDatasets.TRACEMETRICS,
    };

    return EventView.fromNewQueryWithPageFilters(discoverQuery, selection);
  }, [fields, query, selection, sortBys]);

  const result = useSpansQuery({
    enabled: enabled && Boolean(metricName) && fields.length > 0,
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
