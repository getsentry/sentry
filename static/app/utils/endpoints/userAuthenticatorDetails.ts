// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface UserAuthenticatorDetailsResponse {
  // No response keys detected — fill in manually
}

type TQueryData = ApiResponse<UserAuthenticatorDetailsResponse>;
type TData = UserAuthenticatorDetailsResponse;

/**
 * @public
 * Get Authenticator Interface
 *         ```````````````````````````
 *
 *         Retrieves authenticator interface details for user depending on user enrollment status
 *
 *         :pparam string user_id: user id or "me" for current user
 *         :pparam string auth_id: authenticator model id
 *
 *         :auth: required
 */
export function userAuthenticatorDetailsOptions(userId: string, authId: string) {
  return queryOptions({
    queryKey: getQueryKey('/users/$userId/authenticators/$authId/', {
      path: {userId, authId},
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
