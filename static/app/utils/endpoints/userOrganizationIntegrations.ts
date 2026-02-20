// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface UserOrganizationIntegrationsResponse {
  // No response keys detected — fill in manually
}

interface UserOrganizationIntegrationsQueryParams {
  provider?: string;
}

type TQueryData = ApiResponse<UserOrganizationIntegrationsResponse>;
type TData = UserOrganizationIntegrationsResponse;

/**
 * @public
 * Retrieve all of a users' organization integrations
 *         --------------------------------------------------
 *
 *         :pparam string user ID: user ID, or 'me'
 *         :qparam string provider: optional provider to filter by
 *         :auth: required
 */
export function userOrganizationIntegrationsOptions(
  userId: string,
  query?: UserOrganizationIntegrationsQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey('/users/$userId/organization-integrations/', {
      path: {userId},
      query,
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
