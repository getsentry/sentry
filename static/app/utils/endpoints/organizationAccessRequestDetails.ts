// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface OrganizationAccessRequestDetailsResponse {
  // No response keys detected — fill in manually
}

type TQueryData = ApiResponse<OrganizationAccessRequestDetailsResponse>;
type TData = OrganizationAccessRequestDetailsResponse;

/**
 * @public
 * Get a list of requests to join org/team.
 *         If any requests are redundant (user already joined the team), they are not returned.
 */
export function organizationAccessRequestDetailsOptions(
  organization: Organization,
  requestId: string
) {
  return queryOptions({
    queryKey: getQueryKey(
      '/organizations/$organizationIdOrSlug/access-requests/$requestId/',
      {
        path: {organizationIdOrSlug: organization.slug, requestId},
      }
    ),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
