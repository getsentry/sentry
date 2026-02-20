// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface OrganizationMemberDetailsResponse {
  // No response keys detected — fill in manually
}

type TQueryData = ApiResponse<OrganizationMemberDetailsResponse>;
type TData = OrganizationMemberDetailsResponse;

/**
 * @public
 * Retrieve an organization member's details.
 *
 *         Response will be a pending invite if it has been approved by organization owners or managers but is waiting to be accepted by the invitee.
 */
export function organizationMemberDetailsOptions(
  organization: Organization,
  memberId: string
) {
  return queryOptions({
    queryKey: getQueryKey('/organizations/$organizationIdOrSlug/members/$memberId/', {
      path: {organizationIdOrSlug: organization.slug, memberId},
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
