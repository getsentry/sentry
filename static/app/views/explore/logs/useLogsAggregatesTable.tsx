import {useCallback} from 'react';
import {useQuery} from '@tanstack/react-query';

import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {useCaseInsensitivity} from 'sentry/components/searchQueryBuilder/hooks';
import {defined} from 'sentry/utils';
import {apiOptions, selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
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
import {getEventView} from 'sentry/views/insights/common/queries/useDiscover';
import {getStaleTimeForEventView} from 'sentry/views/insights/common/queries/useSpansQuery';

interface UseLogsAggregatesTableOptions {
  enabled: boolean;
  limit?: number;
  queryExtras?: RPCQueryExtras;
  referrer?: string;
}

export function useLogsAggregatesTable({
  enabled,
  limit,
  referrer,
}: UseLogsAggregatesTableOptions) {
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
    data: result.data?.json,
    isLoading: result.isLoading,
    isPending: result.isPending,
    isError: result.isError,
    error: result.error,
    pageLinks,
    eventView,
  };
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
