// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface UserIdentityResponse {
  // No response keys detected — fill in manually
}

interface UserIdentityQueryParams {
  provider?: string;
}

type TQueryData = ApiResponse<UserIdentityResponse>;
type TData = UserIdentityResponse;

/**
 * @public
 * Retrieve all of a users' identities (NOT AuthIdentities)
 *         `````````````````````````````````
 *
 *         :pparam string user ID: user ID, or 'me'
 *         :auth: required
 */
export function userIdentityOptions(userId: string, query?: UserIdentityQueryParams) {
  return queryOptions({
    queryKey: getQueryKey('/users/$userId/identities/', {
      path: {userId},
      query,
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
