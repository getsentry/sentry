import {useCallback, useMemo} from 'react';

import usePageFilters from 'sentry/components/pageFilters/usePageFilters';
import type {NewQuery} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import EventView from 'sentry/utils/discover/eventView';
import {
  useProgressiveQuery,
  type RPCQueryExtras,
} from 'sentry/views/explore/hooks/useProgressiveQuery';
import {
  useQueryParamsExtrapolate,
  useQueryParamsFields,
  useQueryParamsSortBys,
} from 'sentry/views/explore/queryParams/context';
import {useSpansDataset} from 'sentry/views/explore/spans/spansQueryParams';
import {useSpansQuery} from 'sentry/views/insights/common/queries/useSpansQuery';

interface UseExploreSpansTableOptions {
  enabled: boolean;
  limit: number;
  query: string;
  queryExtras?: RPCQueryExtras;
}

export interface SpansTableResult {
  eventView: EventView;
  result: ReturnType<typeof useSpansQuery<any[]>>;
}

export function useExploreSpansTable({
  enabled,
  limit,
  query,
  queryExtras,
}: UseExploreSpansTableOptions) {
  const extrapolate = useQueryParamsExtrapolate();

  const canTriggerHighAccuracy = useCallback(
    (results: ReturnType<typeof useSpansQuery<any[]>>) => {
      const canGoToHigherAccuracyTier = results.meta?.dataScanned === 'partial';
      const hasData = defined(results.data) && results.data.length > 0;
      return !hasData && canGoToHigherAccuracyTier;
    },
    []
  );

  return useProgressiveQuery<typeof useExploreSpansTableImp>({
    queryHookImplementation: useExploreSpansTableImp,
    queryHookArgs: {enabled, limit, query, queryExtras},
    queryOptions: {
      canTriggerHighAccuracy,
      disableExtrapolation: !extrapolate,
    },
  });
}

function useExploreSpansTableImp({
  enabled,
  limit,
  query,
  queryExtras,
}: UseExploreSpansTableOptions): SpansTableResult {
  const {selection} = usePageFilters();

  const dataset = useSpansDataset();
  const fields = useQueryParamsFields();
  const sortBys = useQueryParamsSortBys();

  const visibleFields = useMemo(
    () => (fields.includes('id') ? fields : ['id', ...fields]),
    [fields]
  );

  const eventView = useMemo(() => {
    const queryFields = [
      ...visibleFields,
      'project',
      'trace',
      'transaction.span_id',
      'id',
      'timestamp',
    ];

    const discoverQuery: NewQuery = {
      id: undefined,
      name: 'Explore - Span Samples',
      fields: queryFields,
      orderby: sortBys.map(sort => `${sort.kind === 'desc' ? '-' : ''}${sort.field}`),
      query,
      version: 2,
      dataset,
    };

    return EventView.fromNewQueryWithPageFilters(discoverQuery, selection);
  }, [dataset, sortBys, query, selection, visibleFields]);

  const result = useSpansQuery({
    enabled,
    eventView,
    initialData: [],
    limit,
    referrer: 'api.explore.spans-samples-table',
    allowAggregateConditions: false,
    trackResponseAnalytics: false,
    queryExtras,
  });

  return useMemo(() => {
    return {eventView, result};
  }, [eventView, result]);
}
