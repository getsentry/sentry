import {useCallback, useMemo} from 'react';

import type {NewQuery} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import EventView from 'sentry/utils/discover/eventView';
import type {Sort} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import usePageFilters from 'sentry/utils/usePageFilters';
import {formatSort} from 'sentry/views/explore/contexts/pageParamsContext/sortBys';
import type {AggregatesTableResult} from 'sentry/views/explore/hooks/useExploreAggregatesTable';
import type {SpansTableResult} from 'sentry/views/explore/hooks/useExploreSpansTable';
import {
  useProgressiveQuery,
  type RPCQueryExtras,
} from 'sentry/views/explore/hooks/useProgressiveQuery';
import {getFieldsForConstructedQuery} from 'sentry/views/explore/multiQueryMode/locationUtils';
import {useSpansQuery} from 'sentry/views/insights/common/queries/useSpansQuery';

type Props = {
  enabled: boolean;
  groupBys: string[];
  query: string;
  sortBys: Sort[];
  yAxes: string[];
  queryExtras?: RPCQueryExtras;
};

export function useMultiQueryTableAggregateMode({
  groupBys,
  query,
  yAxes,
  sortBys,
  enabled,
  queryExtras,
}: Props) {
  const canTriggerHighAccuracy = useCallback(
    (results: ReturnType<typeof useSpansQuery<any[]>>) => {
      const canGoToHigherAccuracyTier = results.meta?.dataScanned === 'partial';
      const hasData = defined(results.data) && results.data.length > 0;
      return !hasData && canGoToHigherAccuracyTier;
    },
    []
  );
  return useProgressiveQuery({
    queryHookImplementation: useMultiQueryTableAggregateModeImpl,
    queryHookArgs: {groupBys, query, yAxes, sortBys, enabled, queryExtras},
    queryOptions: {
      canTriggerHighAccuracy,
    },
  });
}

function useMultiQueryTableAggregateModeImpl({
  groupBys,
  query,
  yAxes,
  sortBys,
  enabled,
  queryExtras,
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
    const discoverQuery: NewQuery = {
      id: undefined,
      name: 'Multi Query Mode - Span Aggregates',
      fields,
      orderby: sortBys.map(formatSort),
      query,
      version: 2,
      dataset: DiscoverDatasets.SPANS,
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
    queryExtras,
  });

  return {eventView, fields, result};
}

export function useMultiQueryTableSampleMode({
  query,
  yAxes,
  sortBys,
  enabled,
  queryExtras,
}: Props) {
  const canTriggerHighAccuracy = useCallback(
    (results: ReturnType<typeof useSpansQuery<any[]>>) => {
      const canGoToHigherAccuracyTier = results.meta?.dataScanned === 'partial';
      const hasData = defined(results.data) && results.data.length > 0;
      return !hasData && canGoToHigherAccuracyTier;
    },
    []
  );
  return useProgressiveQuery({
    queryHookImplementation: useMultiQueryTableSampleModeImpl,
    queryHookArgs: {query, yAxes, sortBys, enabled, queryExtras},
    queryOptions: {
      canTriggerHighAccuracy,
    },
  });
}

function useMultiQueryTableSampleModeImpl({
  query,
  yAxes,
  sortBys,
  enabled,
  queryExtras,
}: Props): SpansTableResult {
  const {selection} = usePageFilters();

  const fields = useMemo(() => {
    const allFields: string[] = [];
    allFields.push(...getFieldsForConstructedQuery(yAxes));
    allFields.push(...['transaction.span_id', 'trace', 'project', 'timestamp']);
    return allFields;
  }, [yAxes]);
  const eventView = useMemo(() => {
    const discoverQuery: NewQuery = {
      id: undefined,
      name: 'Multi Query Mode - Samples',
      fields,
      orderby: sortBys.map(formatSort),
      query,
      version: 2,
      dataset: DiscoverDatasets.SPANS,
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
    queryExtras,
  });

  return {eventView, result};
}
