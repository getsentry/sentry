// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface UserDetailsResponse {
  // No response keys detected — fill in manually
}

type TQueryData = ApiResponse<UserDetailsResponse>;
type TData = UserDetailsResponse;

/**
 * @public
 * Retrieve User Details
 *         `````````````````````
 *
 *         Return details for an account's details and options such as: full name, timezone, 24hr times, language,
 *         stacktrace_order.
 *
 *         :auth: required
 */
export function userDetailsOptions(userId: string) {
  return queryOptions({
    queryKey: getQueryKey('/users/$userId/', {
      path: {userId},
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
