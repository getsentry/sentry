import {useMemo} from 'react';

import type {NewQuery} from 'sentry/types/organization';
import EventView from 'sentry/utils/discover/eventView';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import usePageFilters from 'sentry/utils/usePageFilters';
import {
  useExploreDataset,
  useExploreGroupBys,
  useExploreSortBys,
  useExploreVisualizes,
} from 'sentry/views/explore/contexts/pageParamsContext';
import {formatSort} from 'sentry/views/explore/contexts/pageParamsContext/sortBys';
import {useSpansQuery} from 'sentry/views/insights/common/queries/useSpansQuery';

interface UseExploreAggregatesTableOptions {
  enabled: boolean;
  query: string;
}

export interface AggregatesTableResult {
  eventView: EventView;
  fields: string[];
  result: ReturnType<typeof useSpansQuery<any[]>>;
}

export function useExploreAggregatesTable({
  enabled,
  query,
}: UseExploreAggregatesTableOptions): AggregatesTableResult {
  const {selection} = usePageFilters();

  const dataset = useExploreDataset();
  const groupBys = useExploreGroupBys();
  const sorts = useExploreSortBys();
  const visualizes = useExploreVisualizes();

  const fields = useMemo(() => {
    // When rendering the table, we want the group bys first
    // then the aggregates.
    const allFields: string[] = [];

    for (const groupBy of groupBys) {
      if (allFields.includes(groupBy)) {
        continue;
      }
      allFields.push(groupBy);
    }

    for (const visualize of visualizes) {
      for (const yAxis of visualize.yAxes) {
        if (allFields.includes(yAxis)) {
          continue;
        }
        allFields.push(yAxis);
      }
    }

    return allFields.filter(Boolean);
  }, [groupBys, visualizes]);

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
    referrer: 'api.explore.spans-aggregates-table',
  });

  return useMemo(() => {
    return {eventView, fields, result};
  }, [eventView, fields, result]);
}
