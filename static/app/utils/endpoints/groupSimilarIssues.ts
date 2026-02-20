// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface GroupSimilarIssuesResponse {
  // No response keys detected — fill in manually
}

interface GroupSimilarIssuesQueryParams {
  limit?: string;
}

type TQueryData = ApiResponse<GroupSimilarIssuesResponse>;
type TData = GroupSimilarIssuesResponse;

/** @public */
export function groupSimilarIssuesOptions(
  issueId: string,
  query?: GroupSimilarIssuesQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey('/groups/$issueId/similar/', {
      path: {issueId},
      query,
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
