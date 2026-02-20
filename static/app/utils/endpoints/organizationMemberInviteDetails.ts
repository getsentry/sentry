// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: verify these types against the Python endpoint source
interface OrganizationMemberInviteDetailsResponse {
  detail: unknown;
}

type TQueryData = ApiResponse<OrganizationMemberInviteDetailsResponse>;
type TData = OrganizationMemberInviteDetailsResponse;

/**
 * @public
 * Retrieve an invited organization member's details.
 */
export function organizationMemberInviteDetailsOptions(
  organization: Organization,
  memberInviteId: string
) {
  return queryOptions({
    queryKey: getQueryKey(
      '/organizations/$organizationIdOrSlug/invited-members/$memberInviteId/',
      {
        path: {organizationIdOrSlug: organization.slug, memberInviteId},
      }
    ),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
