import {useCallback, useMemo} from 'react';

import type {NewQuery} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import EventView from 'sentry/utils/discover/eventView';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import usePageFilters from 'sentry/utils/usePageFilters';
import {
  useExploreAggregateFields,
  useExploreDataset,
  useExploreSortBys,
} from 'sentry/views/explore/contexts/pageParamsContext';
import {isGroupBy} from 'sentry/views/explore/contexts/pageParamsContext/aggregateFields';
import {formatSort} from 'sentry/views/explore/contexts/pageParamsContext/sortBys';
import type {SpansRPCQueryExtras} from 'sentry/views/explore/hooks/useProgressiveQuery';
import {useProgressiveQuery} from 'sentry/views/explore/hooks/useProgressiveQuery';
import {useSpansQuery} from 'sentry/views/insights/common/queries/useSpansQuery';

interface UseExploreAggregatesTableOptions {
  enabled: boolean;
  limit: number;
  query: string;
  queryExtras?: SpansRPCQueryExtras;
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
}: UseExploreAggregatesTableOptions) {
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
    queryHookArgs: {enabled, limit, query},
    queryOptions: {
      canTriggerHighAccuracy,
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

  const dataset = useExploreDataset();
  const aggregateFields = useExploreAggregateFields();
  const sorts = useExploreSortBys();

  const fields = useMemo(() => {
    // When rendering the table, we want the group bys first
    // then the aggregates.
    const allFields: string[] = [];

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

  const eventView = useMemo(() => {
    const search = new MutableSearch(query);

    // Filtering out all spans with op like 'ui.interaction*' which aren't
    // embedded under transactions. The trace view does not support rendering
    // such spans yet.
    search.addFilterValues('!transaction.span_id', ['00']);

    const discoverQuery: NewQuery = {
      id: undefined,
      name: 'Explore - Span Aggregates',
      fields,
      orderby: sorts.map(formatSort),
      query: search.formatString(),
      version: 2,
      dataset,
    };

    return EventView.fromNewQueryWithPageFilters(discoverQuery, selection);
  }, [dataset, fields, sorts, query, selection]);

  const result = useSpansQuery({
    enabled,
    eventView,
    initialData: [],
    limit,
    referrer: 'api.explore.spans-aggregates-table',
    trackResponseAnalytics: false,
    queryExtras,
  });

  return useMemo(() => {
    return {eventView, fields, result};
  }, [eventView, fields, result]);
}
