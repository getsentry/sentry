import type {UseQueryResult} from '@tanstack/react-query';

import type {CaseInsensitive} from 'sentry/components/searchQueryBuilder/hooks';
import type {ApiResponse} from 'sentry/utils/api/apiFetch';
import type {QueryError} from 'sentry/utils/discover/genericDiscoverQuery';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {
  type TraceResults,
  useTracesApiOptions,
} from 'sentry/views/explore/hooks/useTraces';

interface UseExploreTracesTableOptions {
  limit: number;
  query: string;
  queryExtras?: {
    caseInsensitive?: CaseInsensitive;
    logQuery?: string[];
    metricQuery?: string[];
    spanQuery?: string[];
  };
}

export type TracesTableResult = {
  error: QueryError | null;
  result: UseQueryResult<ApiResponse<TraceResults>, Error>;
};

export function useExploreTracesTableApiOptions({
  limit,
  query,
  queryExtras,
}: UseExploreTracesTableOptions) {
  const location = useLocation();
  const cursor = decodeScalar(location.query.cursor);

  return useTracesApiOptions({
    query,
    limit,
    sort: '-timestamp',
    cursor,
    caseInsensitive: queryExtras?.caseInsensitive,
    logQuery: queryExtras?.logQuery,
    metricQuery: queryExtras?.metricQuery,
    spanQuery: queryExtras?.spanQuery,
  });
}
