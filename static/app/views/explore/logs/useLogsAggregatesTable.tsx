import {useCallback, useMemo} from 'react';
import {useQuery} from '@tanstack/react-query';

import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {useCaseInsensitivity} from 'sentry/components/searchQueryBuilder/hooks';
import {apiOptions, selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';
import {defined} from 'sentry/utils/defined';
import {QueryError} from 'sentry/utils/discover/genericDiscoverQuery';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {defaultAggregateSortBys} from 'sentry/views/explore/contexts/pageParamsContext/aggregateSortBys';
import {
  useProgressiveQuery,
  type RPCQueryExtras,
} from 'sentry/views/explore/hooks/useProgressiveQuery';
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
import type {Visualize} from 'sentry/views/explore/queryParams/visualize';
import {
  areAllVisualizesInvalidConditionalFilters,
  getConditionalFilterInvalidSeriesMessageForVisualizes,
} from 'sentry/views/explore/utils/conditionalAggregate';
import {getEventView} from 'sentry/views/insights/common/queries/useDiscover';
import {getStaleTimeForEventView} from 'sentry/views/insights/common/queries/useSpansQuery';

interface UseLogsAggregatesTableOptions {
  enabled: boolean;
  limit?: number;
  queryExtras?: RPCQueryExtras;
  referrer?: string;
}

export type LogsAggregatesTableResult = ReturnType<typeof useLogsAggregatesTable>;

export function getLogsAggregatesFields(
  groupBys: readonly string[],
  visualizes: readonly Visualize[]
): string[] {
  return [...groupBys.filter(Boolean), ...visualizes.map(visualize => visualize.yAxis)];
}

export function useLogsAggregatesTable({
  enabled,
  limit,
  referrer,
}: UseLogsAggregatesTableOptions) {
  const unvalidatedVisualizes = useQueryParamsVisualizes();
  const skippedForInvalidConditionalFilter = useMemo(
    () => areAllVisualizesInvalidConditionalFilters(unvalidatedVisualizes),
    [unvalidatedVisualizes]
  );
  const invalidConditionalFilterMessage = useMemo(
    () => getConditionalFilterInvalidSeriesMessageForVisualizes(unvalidatedVisualizes),
    [unvalidatedVisualizes]
  );

  const canTriggerHighAccuracy = useCallback(
    (results: ReturnType<typeof useLogsAggregatesTableImpl>['result']) => {
      const json = results.data?.json;
      const canGoToHigherAccuracyTier = json?.meta?.dataScanned === 'partial';
      const hasData = defined(json?.data) && json.data.length > 0;
      return !hasData && canGoToHigherAccuracyTier;
    },
    []
  );

  const {result, pageLinks, eventView} = useProgressiveQuery<
    typeof useLogsAggregatesTableImpl
  >({
    queryHookImplementation: useLogsAggregatesTableImpl, // oxlint-disable-line react/hooks -- useProgressiveQuery takes the query hook as a value and calls it per accuracy tier.
    queryHookArgs: {
      enabled: enabled && !skippedForInvalidConditionalFilter,
      limit,
      referrer,
    },
    queryOptions: {
      canTriggerHighAccuracy,
    },
  });

  const {
    data: resultData,
    error: resultError,
    isError: resultIsError,
    isLoading: resultIsLoading,
    isPending: resultIsPending,
    refetch,
  } = result;

  return useMemo(() => {
    if (skippedForInvalidConditionalFilter) {
      return {
        data: undefined,
        isLoading: false,
        isPending: false,
        isError: true,
        error: new QueryError(invalidConditionalFilterMessage),
        refetch,
        pageLinks: undefined,
        eventView,
      };
    }

    return {
      data: resultData?.json,
      isLoading: resultIsLoading,
      isPending: resultIsPending,
      isError: resultIsError,
      error: resultError,
      refetch,
      pageLinks,
      eventView,
    };
  }, [
    eventView,
    invalidConditionalFilterMessage,
    pageLinks,
    refetch,
    resultData,
    resultError,
    resultIsError,
    resultIsLoading,
    resultIsPending,
    skippedForInvalidConditionalFilter,
  ]);
}

function useLogsAggregatesTableImpl({
  enabled,
  limit,
  referrer,
  queryExtras,
}: UseLogsAggregatesTableOptions) {
  referrer = referrer ?? 'api.explore.logs-table-aggregates';
  const {queryOptions, eventView} = useLogsAggregatesApiOptions({
    limit,
    queryExtras,
    referrer,
  });

  const result = useQuery({
    ...queryOptions,
    select: selectJsonWithHeaders,
    enabled,
    refetchOnWindowFocus: false,
    retry: false,
  });

  return {
    result,
    pageLinks: result.data?.headers.Link,
    eventView,
  };
}

function useLogsAggregatesApiOptions({
  limit,
  referrer,
  queryExtras,
}: {
  referrer: string;
  limit?: number;
  queryExtras?: RPCQueryExtras;
}) {
  const organization = useOrganization();
  const _search = useQueryParamsSearch();
  const baseSearch = useLogsFrozenSearch();
  const {selection} = usePageFilters();
  const location = useLocation();
  const projectIds = useLogsFrozenProjectIds();
  const groupBys = useQueryParamsGroupBys();
  const visualizes = useQueryParamsVisualizes({validate: true});
  const aggregateSortBys = useQueryParamsAggregateSortBys();
  const aggregateCursor = useQueryParamsAggregateCursor();
  const [caseInsensitive] = useCaseInsensitivity();
  const fields = getLogsAggregatesFields(groupBys, visualizes);
  // Drop orderbys that point at series removed by `_if` validation.
  const allowedFields = new Set(fields);
  const validSortBys = aggregateSortBys.filter(sort => allowedFields.has(sort.field));
  const resolvedSortBys = validSortBys.length
    ? validSortBys
    : defaultAggregateSortBys(visualizes.map(visualize => visualize.yAxis));

  const search = baseSearch ? _search.copy() : _search;
  if (baseSearch) {
    search.tokens.push(...baseSearch.tokens);
  }
  const pageFilters = selection;
  const dataset = DiscoverDatasets.OURLOGS;

  const eventView = getEventView(
    search,
    fields,
    resolvedSortBys.slice(),
    pageFilters,
    dataset,
    projectIds ?? pageFilters.projects
  );
  const options = apiOptions.as<LogsAggregatesResult>()(
    '/organizations/$organizationIdOrSlug/events/',
    {
      path: {organizationIdOrSlug: organization.slug},
      query: {
        ...eventView.getEventsAPIPayload(location),
        per_page: limit ? limit : undefined,
        cursor: aggregateCursor,
        referrer,
        caseInsensitive,
        sampling: queryExtras?.samplingMode,
      },
      staleTime: getStaleTimeForEventView(eventView),
    }
  );

  return {
    queryOptions: options,
    eventView,
  };
}
