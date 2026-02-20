// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface UserRegionsResponse {
  // No response keys detected — fill in manually
}

type TQueryData = ApiResponse<UserRegionsResponse>;
type TData = UserRegionsResponse;

/**
 * @public
 * Retrieve the Regions a User has membership in
 *         `````````````````````````````````````````````
 *
 *         Returns a list of regions that the current user has membership in.
 *         :auth: required
 */
export function userRegionsOptions(userId: string) {
  return queryOptions({
    queryKey: getQueryKey('/users/$userId/regions/', {
      path: {userId},
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
