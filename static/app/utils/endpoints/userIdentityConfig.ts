// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface UserIdentityConfigResponse {
  // No response keys detected — fill in manually
}

type TQueryData = ApiResponse<UserIdentityConfigResponse>;
type TData = UserIdentityConfigResponse;

/**
 * @public
 * Retrieve all of a user's SocialIdentity, Identity, and AuthIdentity values
 *         ``````````````````````````````````````````````````````````````````````````
 *
 *         :pparam string user ID: user ID, or 'me'
 *         :auth: required
 */
export function userIdentityConfigOptions(userId: string) {
  return queryOptions({
    queryKey: getQueryKey('/users/$userId/user-identities/', {
      path: {userId},
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
