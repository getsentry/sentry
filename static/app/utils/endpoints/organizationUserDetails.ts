// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface OrganizationUserDetailsResponse {
  // No response keys detected — fill in manually
}

type TQueryData = ApiResponse<OrganizationUserDetailsResponse>;
type TData = OrganizationUserDetailsResponse;

/** @public */
export function organizationUserDetailsOptions(
  organization: Organization,
  userId: string
) {
  return queryOptions({
    queryKey: getQueryKey('/organizations/$organizationIdOrSlug/users/$userId/', {
      path: {organizationIdOrSlug: organization.slug, userId},
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
