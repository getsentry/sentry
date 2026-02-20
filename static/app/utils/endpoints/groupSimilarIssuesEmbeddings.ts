// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface GroupSimilarIssuesEmbeddingsResponse {
  // No response keys detected — fill in manually
}

interface GroupSimilarIssuesEmbeddingsQueryParams {
  k?: string;
  threshold?: string;
  useReranking?: string;
}

type TQueryData = ApiResponse<GroupSimilarIssuesEmbeddingsResponse>;
type TData = GroupSimilarIssuesEmbeddingsResponse;

/** @public */
export function groupSimilarIssuesEmbeddingsOptions(
  issueId: string,
  query?: GroupSimilarIssuesEmbeddingsQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey('/groups/$issueId/similar-issues-embeddings/', {
      path: {issueId},
      query,
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
