// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface OrganizationInviteRequestDetailsResponse {
  // No response keys detected — fill in manually
}

type TQueryData = ApiResponse<OrganizationInviteRequestDetailsResponse>;
type TData = OrganizationInviteRequestDetailsResponse;

/** @public */
export function organizationInviteRequestDetailsOptions(
  organization: Organization,
  memberId: string
) {
  return queryOptions({
    queryKey: getQueryKey(
      '/organizations/$organizationIdOrSlug/invite-requests/$memberId/',
      {
        path: {organizationIdOrSlug: organization.slug, memberId},
      }
    ),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
