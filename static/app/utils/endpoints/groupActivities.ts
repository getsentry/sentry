// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: verify these types against the Python endpoint source
interface GroupActivitiesResponse {
  activity: unknown;
}

type TQueryData = ApiResponse<GroupActivitiesResponse>;
type TData = GroupActivitiesResponse;

/**
 * @public
 * Retrieve all the Activities for a Group
 */
export function groupActivitiesOptions(issueId: string) {
  return queryOptions({
    queryKey: getQueryKey('/groups/$issueId/activities/', {
      path: {issueId},
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
