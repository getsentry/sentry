// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface OrganizationIncidentDetailsResponse {
  // No response keys detected — fill in manually
}

type TQueryData = ApiResponse<OrganizationIncidentDetailsResponse>;
type TData = OrganizationIncidentDetailsResponse;

/**
 * @public
 * Fetch an Incident.
 *         ``````````````````
 *         :auth: required
 */
export function organizationIncidentDetailsOptions(
  organization: Organization,
  incidentIdentifier: string
) {
  return queryOptions({
    queryKey: getQueryKey(
      '/organizations/$organizationIdOrSlug/incidents/$incidentIdentifier/',
      {
        path: {organizationIdOrSlug: organization.slug, incidentIdentifier},
      }
    ),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
