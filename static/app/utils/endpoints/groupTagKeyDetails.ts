// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface GroupTagKeyDetailsResponse {
  // No response keys detected — fill in manually
}

interface GroupTagKeyDetailsQueryParams {
  /** The name of environments to filter by. */
  environment?: string[];
}

type TQueryData = ApiResponse<GroupTagKeyDetailsResponse>;
type TData = GroupTagKeyDetailsResponse;

/**
 * @public
 * Returns the values and aggregate details of a given tag key related to an issue.
 */
export function groupTagKeyDetailsOptions(
  issueId: string,
  key: string,
  query?: GroupTagKeyDetailsQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey('/issues/$issueId/tags/$key/', {
      path: {issueId, key},
      query,
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
