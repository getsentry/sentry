import {useCallback, useMemo} from 'react';

import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import type {NewQuery} from 'sentry/types/organization';
import {defined} from 'sentry/utils/defined';
import {EventView} from 'sentry/utils/discover/eventView';
import {isGroupBy} from 'sentry/views/explore/contexts/pageParamsContext/aggregateFields';
import {formatSort} from 'sentry/views/explore/contexts/pageParamsContext/sortBys';
import type {RPCQueryExtras} from 'sentry/views/explore/hooks/useProgressiveQuery';
import {useProgressiveQuery} from 'sentry/views/explore/hooks/useProgressiveQuery';
import {
  useQueryParamsAggregateCursor,
  useQueryParamsAggregateFields,
  useQueryParamsAggregateSortBys,
  useQueryParamsExtrapolate,
} from 'sentry/views/explore/queryParams/context';
import {useSpansDataset} from 'sentry/views/explore/spans/spansQueryParams';
import {CONDITIONAL_FILTER_INVALID_SERIES_MESSAGE} from 'sentry/views/explore/utils/conditionalAggregate';
import {useSpansQuery} from 'sentry/views/insights/common/queries/useSpansQuery';
import {SpanFields} from 'sentry/views/insights/types';

interface UseExploreAggregatesTableOptions {
  enabled: boolean;
  limit: number;
  query: string;
  queryExtras?: RPCQueryExtras;
}

export interface AggregatesTableResult {
  eventView: EventView;
  fields: string[];
  result: ReturnType<typeof useSpansQuery<any[]>>;
}

export function useExploreAggregatesTable({
  enabled,
  limit,
  query,
  queryExtras,
}: UseExploreAggregatesTableOptions) {
  const extrapolate = useQueryParamsExtrapolate();

  const canTriggerHighAccuracy = useCallback(
    (results: ReturnType<typeof useSpansQuery<any[]>>) => {
      const canGoToHigherAccuracyTier = results.meta?.dataScanned === 'partial';
      const hasData = defined(results.data) && results.data.length > 0;
      return !hasData && canGoToHigherAccuracyTier;
    },
    []
  );
  return useProgressiveQuery<typeof useExploreAggregatesTableImp>({
    queryHookImplementation: useExploreAggregatesTableImp,
    queryHookArgs: {enabled, limit, query, queryExtras},
    queryOptions: {
      canTriggerHighAccuracy,
      disableExtrapolation: !extrapolate,
    },
  });
}

function useExploreAggregatesTableImp({
  enabled,
  limit,
  query,
  queryExtras,
}: UseExploreAggregatesTableOptions): AggregatesTableResult {
  const {selection} = usePageFilters();

  const dataset = useSpansDataset();
  const aggregateCursor = useQueryParamsAggregateCursor();
  const aggregateFields = useQueryParamsAggregateFields({validate: true});
  const aggregateSortBys = useQueryParamsAggregateSortBys();

  const fields = useMemo(() => {
    // When rendering the table, we want the group bys first
    // then the aggregates.
    const allFields: string[] = [
      `any(${SpanFields.TRACE})`,
      `any(${SpanFields.TIMESTAMP})`,
    ];

    for (const aggregateField of aggregateFields) {
      if (isGroupBy(aggregateField)) {
        if (allFields.includes(aggregateField.groupBy)) {
          continue;
        }
        allFields.push(aggregateField.groupBy);
      } else {
        if (allFields.includes(aggregateField.yAxis)) {
          continue;
        }
        allFields.push(aggregateField.yAxis);
      }
    }

    return allFields.filter(Boolean);
  }, [aggregateFields]);

  const hasValidVisualize = useMemo(
    () => aggregateFields.some(aggregateField => !isGroupBy(aggregateField)),
    [aggregateFields]
  );

  const eventView = useMemo(() => {
    const discoverQuery: NewQuery = {
      id: undefined,
      name: 'Explore - Span Aggregates',
      fields,
      orderby: aggregateSortBys.map(formatSort),
      query,
      version: 2,
      dataset,
    };

    return EventView.fromNewQueryWithPageFilters(discoverQuery, selection);
  }, [dataset, fields, aggregateSortBys, query, selection]);

  const result = useSpansQuery({
    // Skip the request when every series was dropped for an invalid `_if` filter.
    enabled: enabled && hasValidVisualize,
    eventView,
    cursor: aggregateCursor,
    initialData: [],
    limit,
    referrer: 'api.explore.spans-aggregates-table',
    trackResponseAnalytics: false,
    queryExtras,
  });

  return useMemo(() => {
    // A disabled query stays `isPending` forever; surface a settled error so the
    // aggregates table does not spin and the tab can show the same message as the chart.
    if (!hasValidVisualize) {
      return {
        eventView,
        fields,
        result: {
          ...result,
          data: [],
          error: new Error(CONDITIONAL_FILTER_INVALID_SERIES_MESSAGE),
          isError: true,
          isFetched: true,
          isFetching: false,
          isLoading: false,
          isPending: false,
          isSuccess: false,
          status: 'error' as const,
        },
      };
    }
    return {eventView, fields, result};
  }, [eventView, fields, hasValidVisualize, result]);
}
