import type {UseQueryResult} from '@tanstack/react-query';

import type {CaseInsensitive} from 'sentry/components/searchQueryBuilder/hooks';
import type {ApiResponse} from 'sentry/utils/api/apiFetch';
import type {QueryError} from 'sentry/utils/discover/genericDiscoverQuery';
import {
  type TraceResults,
  useTracesApiOptions,
} from 'sentry/views/explore/hooks/useTraces';
import {useQueryParamsCursor} from 'sentry/views/explore/queryParams/context';

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
  result: UseQueryResult<ApiResponse<TraceResults>>;
};

export function useExploreTracesTableApiOptions({
  limit,
  query,
  queryExtras,
}: UseExploreTracesTableOptions) {
  const cursor = useQueryParamsCursor();

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
