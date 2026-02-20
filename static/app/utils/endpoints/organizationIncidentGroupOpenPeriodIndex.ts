// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: verify these types against the Python endpoint source
interface OrganizationIncidentGroupOpenPeriodIndexResponse {
  groupId: string | number;
  incidentId: string | number;
  incidentIdentifier: unknown;
  openPeriodId: string | number;
}

type TQueryData = ApiResponse<OrganizationIncidentGroupOpenPeriodIndexResponse>;
type TData = OrganizationIncidentGroupOpenPeriodIndexResponse;

/**
 * @public
 * Returns an incident and group open period relationship.
 *         Can optionally filter by incident_id, incident_identifier, group_id, or open_period_id.
 *         If incident_identifier is provided but no match is found, falls back to calculating
 *         open_period_id by subtracting 10^9 from the incident_identifier and looking up the
 *         GroupOpenPeriod directly.
 */
export function organizationIncidentGroupOpenPeriodIndexOptions(
  organization: Organization
) {
  return queryOptions({
    queryKey: getQueryKey(
      '/organizations/$organizationIdOrSlug/incident-groupopenperiod/',
      {
        path: {organizationIdOrSlug: organization.slug},
      }
    ),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
