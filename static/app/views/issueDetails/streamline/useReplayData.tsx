import {
  type ApiQueryKey,
  useApiQuery,
  type UseApiQueryOptions,
} from 'sentry/utils/queryClient';

interface ReplayDataParameters {
  orgSlug: string;
  query: {
    data_source: 'discover' | 'search_issues';
    query: string;
    statsPeriod: string;
    environment?: string[];
    returnIds?: boolean;
  };
}

type Result = any;

export function makeStreamlineReplayCountQueryKey({
  orgSlug,
  query,
}: ReplayDataParameters): ApiQueryKey {
  return [`/organizations/${orgSlug}/replay-count/`, {query}];
}

export function useStreamlineReplayCount(
  params: ReplayDataParameters,
  options: Partial<UseApiQueryOptions<Result>> = {}
) {
  return useApiQuery<Result>(makeStreamlineReplayCountQueryKey(params), {
    staleTime: Infinity,
    retry: false,
    ...options,
  });
}
