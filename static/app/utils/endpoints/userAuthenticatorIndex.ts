// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface UserAuthenticatorIndexResponse {
  // No response keys detected — fill in manually
}

type TQueryData = ApiResponse<UserAuthenticatorIndexResponse>;
type TData = UserAuthenticatorIndexResponse;

/**
 * @public
 * Returns all interface for a user (un-enrolled ones), otherwise an empty array
 */
export function userAuthenticatorIndexOptions(userId: string) {
  return queryOptions({
    queryKey: getQueryKey('/users/$userId/authenticators/', {
      path: {userId},
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
