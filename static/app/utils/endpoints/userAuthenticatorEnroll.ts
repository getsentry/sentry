// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface UserAuthenticatorEnrollResponse {
  // No response keys detected — fill in manually
}

type TQueryData = ApiResponse<UserAuthenticatorEnrollResponse>;
type TData = UserAuthenticatorEnrollResponse;

/**
 * @public
 * Get Authenticator Interface
 *         ```````````````````````````
 *
 *         Retrieves authenticator interface details for user depending on user enrollment status
 *
 *         :pparam string user_id: user id or "me" for current user
 *         :pparam string interface_id: interface id
 *
 *         :auth: required
 */
export function userAuthenticatorEnrollOptions(userId: string, interfaceId: string) {
  return queryOptions({
    queryKey: getQueryKey('/users/$userId/authenticators/$interfaceId/enroll/', {
      path: {userId, interfaceId},
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
