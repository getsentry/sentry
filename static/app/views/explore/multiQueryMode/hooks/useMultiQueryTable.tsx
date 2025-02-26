import {useMemo} from 'react';

import type {NewQuery} from 'sentry/types/organization';
import EventView from 'sentry/utils/discover/eventView';
import type {Sort} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import usePageFilters from 'sentry/utils/usePageFilters';
import {formatSort} from 'sentry/views/explore/contexts/pageParamsContext/sortBys';
import type {AggregatesTableResult} from 'sentry/views/explore/hooks/useExploreAggregatesTable';
import type {SpansTableResult} from 'sentry/views/explore/hooks/useExploreSpansTable';
import {getFieldsForConstructedQuery} from 'sentry/views/explore/multiQueryMode/locationUtils';
import {useSpansQuery} from 'sentry/views/insights/common/queries/useSpansQuery';

type Props = {
  enabled: boolean;
  groupBys: string[];
  query: string;
  sortBys: Sort[];
  yAxes: string[];
};

export function useMultiQueryTableAggregateMode({
  groupBys,
  query,
  yAxes,
  sortBys,
  enabled,
}: Props): AggregatesTableResult {
  const {selection} = usePageFilters();

  const fields = useMemo(() => {
    const allFields: Set<string> = new Set();

    for (const groupBy of groupBys) {
      allFields.add(groupBy);
    }

    for (const yAxis of yAxes) {
      allFields.add(yAxis);
    }
    return Array.from(allFields).filter(Boolean);
  }, [groupBys, yAxes]);

  const eventView = useMemo(() => {
    const search = new MutableSearch(query);

    // Filtering out all spans with op like 'ui.interaction*' which aren't
    // embedded under transactions. The trace view does not support rendering
    // such spans yet.
    search.addFilterValues('!transaction.span_id', ['00']);

    const discoverQuery: NewQuery = {
      id: undefined,
      name: 'Multi Query Mode - Span Aggregates',
      fields,
      orderby: sortBys.map(formatSort),
      query: search.formatString(),
      version: 2,
      dataset: DiscoverDatasets.SPANS_EAP_RPC,
    };

    return EventView.fromNewQueryWithPageFilters(discoverQuery, selection);
  }, [query, fields, sortBys, selection]);

  const result = useSpansQuery({
    enabled,
    eventView,
    initialData: [],
    limit: 10,
    referrer: 'api.explore.multi-query-spans-table',
    trackResponseAnalytics: false,
  });

  return {eventView, fields, result};
}

export function useMultiQueryTableSampleMode({
  query,
  yAxes,
  sortBys,
  enabled,
}: Props): SpansTableResult {
  const {selection} = usePageFilters();

  const fields = useMemo(() => {
    const allFields: string[] = [];
    allFields.push(...getFieldsForConstructedQuery(yAxes));
    allFields.push(...['transaction.span_id', 'trace', 'project', 'timestamp']);
    return allFields;
  }, [yAxes]);
  const eventView = useMemo(() => {
    const search = new MutableSearch(query);

    // Filtering out all spans with op like 'ui.interaction*' which aren't
    // embedded under transactions. The trace view does not support rendering
    // such spans yet.
    search.addFilterValues('!transaction.span_id', ['00']);

    const discoverQuery: NewQuery = {
      id: undefined,
      name: 'Multi Query Mode - Samples',
      fields,
      orderby: sortBys.map(formatSort),
      query: search.formatString(),
      version: 2,
      dataset: DiscoverDatasets.SPANS_EAP_RPC,
    };

    return EventView.fromNewQueryWithPageFilters(discoverQuery, selection);
  }, [query, fields, sortBys, selection]);

  const result = useSpansQuery({
    enabled,
    eventView,
    initialData: [],
    limit: 10,
    referrer: 'api.explore.multi-query-spans-table',
    trackResponseAnalytics: false,
  });

  return {eventView, result};
}
