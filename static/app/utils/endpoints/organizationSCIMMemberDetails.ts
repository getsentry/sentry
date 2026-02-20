// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface OrganizationSCIMMemberDetailsResponse {
  // No response keys detected — fill in manually
}

type TQueryData = ApiResponse<OrganizationSCIMMemberDetailsResponse>;
type TData = OrganizationSCIMMemberDetailsResponse;

/**
 * @public
 * Query an individual organization member with a SCIM User GET Request.
 *         - The `name` object will contain fields `firstName` and `lastName` with the values of `N/A`.
 *         Sentry's SCIM API does not currently support these fields but returns them for compatibility purposes.
 */
export function organizationSCIMMemberDetailsOptions(
  organization: Organization,
  memberId: string
) {
  return queryOptions({
    queryKey: getQueryKey(
      '/organizations/$organizationIdOrSlug/scim/v2/Users/$memberId',
      {
        path: {organizationIdOrSlug: organization.slug, memberId},
      }
    ),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
