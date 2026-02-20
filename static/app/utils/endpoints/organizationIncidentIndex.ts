// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface OrganizationIncidentIndexResponse {
  // No response keys detected — fill in manually
}

interface OrganizationIncidentIndexQueryParams {
  alertRule?: string;
  end?: string;
  environment?: string;
  expand?: string[];
  includeSnapshots?: string;
  project?: string;
  start?: string;
  status?: string;
  team?: string[];
  title?: string;
}

type TQueryData = ApiResponse<OrganizationIncidentIndexResponse>;
type TData = OrganizationIncidentIndexResponse;

/**
 * @public
 * List Incidents that a User can access within an Organization
 *         ````````````````````````````````````````````````````````````
 *         Returns a paginated list of Incidents that a user can access.
 *
 *         :auth: required
 */
export function organizationIncidentIndexOptions(
  organization: Organization,
  query?: OrganizationIncidentIndexQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey('/organizations/$organizationIdOrSlug/incidents/', {
      path: {organizationIdOrSlug: organization.slug},
      query,
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
