// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface GroupCurrentReleaseResponse {
  // No response keys detected — fill in manually
}

interface GroupCurrentReleaseQueryParams {
  environment?: string;
}

type TQueryData = ApiResponse<GroupCurrentReleaseResponse>;
type TData = GroupCurrentReleaseResponse;

/**
 * @public
 * Get the current release in the group's project.
 *
 *         Find the most recent release in the project associated with the issue
 *         being viewed, regardless of whether the issue has been reported in that
 *         release. (That is, the latest release in which the user might expect to
 *         have seen the issue.) Then, if the issue has indeed been seen in that
 *         release, provide a reference to it. If not, indicate so with a null
 *         value for "current release".
 *
 *         If the user is filtering by environment, include only releases in those
 *         environments. If `environments` is empty, include all environments
 *         because the user is not filtering.
 */
export function groupCurrentReleaseOptions(
  issueId: string,
  query?: GroupCurrentReleaseQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey('/groups/$issueId/current-release/', {
      path: {issueId},
      query,
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
