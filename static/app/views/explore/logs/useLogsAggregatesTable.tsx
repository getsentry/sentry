import {useCallback} from 'react';

import {useCaseInsensitivity} from 'sentry/components/searchQueryBuilder/hooks';
import {defined} from 'sentry/utils';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useApiQuery, type ApiQueryKey} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useProgressiveQuery} from 'sentry/views/explore/hooks/useProgressiveQuery';
import {
  useLogsFrozenProjectIds,
  useLogsFrozenSearch,
} from 'sentry/views/explore/logs/logsFrozenContext';
import {type LogsAggregatesResult} from 'sentry/views/explore/logs/types';
import {
  useQueryParamsAggregateCursor,
  useQueryParamsAggregateSortBys,
  useQueryParamsGroupBys,
  useQueryParamsSearch,
  useQueryParamsVisualizes,
} from 'sentry/views/explore/queryParams/context';
import {getEventView} from 'sentry/views/insights/common/queries/useDiscover';
import {getStaleTimeForEventView} from 'sentry/views/insights/common/queries/useSpansQuery';

interface UseLogsAggregatesTableOptions {
  enabled: boolean;
  limit?: number;
  referrer?: string;
}

export function useLogsAggregatesTable({
  enabled,
  limit,
  referrer,
}: UseLogsAggregatesTableOptions) {
  const canTriggerHighAccuracy = useCallback(
    (results: ReturnType<typeof useLogsAggregatesTableImpl>['result']) => {
      const canGoToHigherAccuracyTier = results.data?.meta?.dataScanned === 'partial';
      const hasData = defined(results.data?.data) && results.data.data.length > 0;
      return !hasData && canGoToHigherAccuracyTier;
    },
    []
  );

  const aggregateTableResult = useProgressiveQuery<typeof useLogsAggregatesTableImpl>({
    queryHookImplementation: useLogsAggregatesTableImpl,
    queryHookArgs: {
      enabled,
      limit,
      referrer,
    },
    queryOptions: {
      canTriggerHighAccuracy,
    },
  });

  return {
    ...aggregateTableResult.result,
    pageLinks: aggregateTableResult.pageLinks,
    eventView: aggregateTableResult.eventView,
  };
}

function useLogsAggregatesTableImpl({
  enabled,
  limit,
  referrer,
}: UseLogsAggregatesTableOptions) {
  const _referrer = referrer ?? 'api.explore.logs-table-aggregates';
  const {queryKey, other} = useLogsAggregatesQueryKey({limit, referrer: _referrer});

  const queryResult = useApiQuery<LogsAggregatesResult>(queryKey, {
    enabled,
    staleTime: getStaleTimeForEventView(other.eventView),
    refetchOnWindowFocus: false,
    retry: false,
  });

  return {
    result: queryResult,
    pageLinks: queryResult?.getResponseHeader?.('Link') ?? undefined,
    eventView: other.eventView,
  };
}

function useLogsAggregatesQueryKey({
  limit,
  referrer,
}: {
  referrer: string;
  limit?: number;
}) {
  const organization = useOrganization();
  const _search = useQueryParamsSearch();
  const baseSearch = useLogsFrozenSearch();
  const {selection, isReady: pageFiltersReady} = usePageFilters();
  const location = useLocation();
  const projectIds = useLogsFrozenProjectIds();
  const groupBys = useQueryParamsGroupBys();
  const visualizes = useQueryParamsVisualizes();
  const aggregateSortBys = useQueryParamsAggregateSortBys();
  const aggregateCursor = useQueryParamsAggregateCursor();
  const [caseInsensitive] = useCaseInsensitivity();
  const fields: string[] = [];
  fields.push(...groupBys.filter(Boolean));
  fields.push(...visualizes.map(visualize => visualize.yAxis));

  const search = baseSearch ? _search.copy() : _search;
  if (baseSearch) {
    search.tokens.push(...baseSearch.tokens);
  }
  const pageFilters = selection;
  const dataset = DiscoverDatasets.OURLOGS;

  const eventView = getEventView(
    search,
    fields,
    aggregateSortBys.slice(),
    pageFilters,
    dataset,
    projectIds ?? pageFilters.projects
  );
  const params = {
    query: {
      ...eventView.getEventsAPIPayload(location),
      per_page: limit ? limit : undefined,
      cursor: aggregateCursor,
      referrer,
      caseInsensitive,
    },
    pageFiltersReady,
    eventView,
  };

  const queryKey: ApiQueryKey = [`/organizations/${organization.slug}/events/`, params];

  return {
    queryKey,
    other: {
      eventView,
      pageFiltersReady,
    },
  };
}
