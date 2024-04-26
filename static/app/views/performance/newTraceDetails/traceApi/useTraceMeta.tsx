import {useMemo} from 'react';
import type {Location} from 'history';
import * as qs from 'query-string';

import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {DEFAULT_STATS_PERIOD} from 'sentry/constants';
import type {PageFilters} from 'sentry/types/core';
import type {TraceMeta} from 'sentry/utils/performance/quickTrace/types';
import {useApiQuery, type UseApiQueryResult} from 'sentry/utils/queryClient';
import {decodeScalar} from 'sentry/utils/queryString';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useParams} from 'sentry/utils/useParams';

function getMetaQueryParams(
  query: Location['query'],
  filters: Partial<PageFilters> = {}
):
  | {
      // demo has the format ${projectSlug}:${eventId}
      // used to query a demo transaction event from the backend.
      demo: string | undefined;
      statsPeriod: string;
    }
  | {
      demo: string | undefined;
      timestamp: string;
    } {
  const normalizedParams = normalizeDateTimeParams(query, {
    allowAbsolutePageDatetime: true,
  });

  const statsPeriod = decodeScalar(normalizedParams.statsPeriod);
  const timestamp = decodeScalar(normalizedParams.timestamp);

  if (timestamp) {
    return {timestamp, demo: decodeScalar(normalizedParams.demo)};
  }

  return {
    statsPeriod: (statsPeriod || filters?.datetime?.period) ?? DEFAULT_STATS_PERIOD,
    demo: decodeScalar(normalizedParams.demo),
  };
}

export function useTraceMeta(
  traceSlug?: string
): UseApiQueryResult<TraceMeta | null, any> {
  const filters = usePageFilters();
  const organization = useOrganization();
  const params = useParams<{traceSlug?: string}>();

  const queryParams = useMemo(() => {
    const query = qs.parse(location.search);
    return getMetaQueryParams(query, filters.selection);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mode = queryParams.demo ? 'demo' : undefined;
  const trace = traceSlug ?? params.traceSlug;

  const traceMetaQueryResults = useApiQuery<TraceMeta>(
    [
      `/organizations/${organization.slug}/events-trace-meta/${trace ?? ''}/`,
      {query: queryParams},
    ],
    {
      staleTime: Infinity,
      enabled: !!trace && !!organization.slug && mode !== 'demo',
    }
  );

  // When projects don't have performance set up, we allow them to view a sample transaction.
  // The backend creates the sample transaction, however the trace is created async, so when the
  // page loads, we cannot guarantee that querying the trace will succeed as it may not have been stored yet.
  // When this happens, we assemble a fake trace response to only include the transaction that had already been
  // created and stored already so that the users can visualize in the context of a trace.
  // The trace meta query has to reflect this by returning a single transaction and project.
  if (mode === 'demo') {
    return {
      data: {
        errors: 0,
        performance_issues: 0,
        projects: 1,
        transactions: 1,
      },
      failureCount: 0,
      errorUpdateCount: 0,
      failureReason: null,
      error: null,
      isError: false,
      isFetched: true,
      isFetchedAfterMount: true,
      isFetching: false,
      isLoading: false,
      isLoadingError: false,
      isInitialLoading: false,
      isPaused: false,
      isPlaceholderData: false,
      isPreviousData: false,
      isRefetchError: false,
      isRefetching: false,
      isStale: false,
      isSuccess: true,
      status: 'success',
      fetchStatus: 'idle',
      dataUpdatedAt: Date.now(),
      errorUpdatedAt: Date.now(),
      refetch: traceMetaQueryResults.refetch,
      remove: traceMetaQueryResults.remove,
    };
  }

  return traceMetaQueryResults;
}
