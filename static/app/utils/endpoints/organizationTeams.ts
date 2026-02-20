// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface OrganizationTeamsResponse {
  // No response keys detected — fill in manually
}

interface OrganizationTeamsQueryParams {
  /** A pointer to the last object fetched and its sort order; used to retrieve the next or previous results. */
  cursor?: string;
  /** Specify `"0"` to return team details that do not include projects. */
  detailed?: string;
}

type TQueryData = ApiResponse<OrganizationTeamsResponse>;
type TData = OrganizationTeamsResponse;

/**
 * @public
 * Returns a list of teams bound to a organization.
 */
export function organizationTeamsOptions(
  organization: Organization,
  query?: OrganizationTeamsQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey('/organizations/$organizationIdOrSlug/teams/', {
      path: {organizationIdOrSlug: organization.slug},
      query,
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
