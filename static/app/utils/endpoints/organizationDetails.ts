// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface OrganizationDetailsResponse {
  // No response keys detected — fill in manually
}

interface OrganizationDetailsQueryParams {
  /** Specify `"0"` to return organization details that do not include projects or teams. */
  detailed?: string;
}

type TQueryData = ApiResponse<OrganizationDetailsResponse>;
type TData = OrganizationDetailsResponse;

/**
 * @public
 * Return details on an individual organization, including various details
 *         such as membership access and teams.
 */
export function organizationDetailsOptions(
  organization: Organization,
  query?: OrganizationDetailsQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey('/organizations/$organizationIdOrSlug/', {
      path: {organizationIdOrSlug: organization.slug},
      query,
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
