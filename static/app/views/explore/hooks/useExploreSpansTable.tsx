import {useMemo} from 'react';

import type {NewQuery} from 'sentry/types/organization';
import EventView from 'sentry/utils/discover/eventView';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import usePageFilters from 'sentry/utils/usePageFilters';
import {
  useExploreDataset,
  useExploreFields,
  useExploreSortBys,
} from 'sentry/views/explore/contexts/pageParamsContext';
import {useSpansQuery} from 'sentry/views/insights/common/queries/useSpansQuery';

interface UseExploreSpansTableOptions {
  enabled: boolean;
  query: string;
}

export interface SpansTableResult {
  eventView: EventView;
  result: ReturnType<typeof useSpansQuery<any[]>>;
}

export function useExploreSpansTable({
  enabled,
  query,
}: UseExploreSpansTableOptions): SpansTableResult {
  const {selection} = usePageFilters();

  const dataset = useExploreDataset();
  const fields = useExploreFields();
  const sortBys = useExploreSortBys();

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

    const search = new MutableSearch(query);

    // Filtering out all spans with op like 'ui.interaction*' which aren't
    // embedded under transactions. The trace view does not support rendering
    // such spans yet.
    search.addFilterValues('!transaction.span_id', ['00']);

    const discoverQuery: NewQuery = {
      id: undefined,
      name: 'Explore - Span Samples',
      fields: queryFields,
      orderby: sortBys.map(sort => `${sort.kind === 'desc' ? '-' : ''}${sort.field}`),
      query: search.formatString(),
      version: 2,
      dataset,
    };

    return EventView.fromNewQueryWithPageFilters(discoverQuery, selection);
  }, [dataset, sortBys, query, selection, visibleFields]);

  const result = useSpansQuery({
    enabled,
    eventView,
    initialData: [],
    referrer: 'api.explore.spans-samples-table',
    allowAggregateConditions: false,
  });

  return useMemo(() => {
    return {eventView, result};
  }, [eventView, result]);
}
