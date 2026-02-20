// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface UserIPsResponse {
  // No response keys detected — fill in manually
}

type TQueryData = ApiResponse<UserIPsResponse>;
type TData = UserIPsResponse;

/**
 * @public
 * Get list of IP addresses
 *         ````````````````````````
 *
 *         Returns a list of IP addresses used to authenticate against this account.
 *
 *         :auth required:
 */
export function userIPsOptions(userId: string) {
  return queryOptions({
    queryKey: getQueryKey('/users/$userId/ips/', {
      path: {userId},
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
