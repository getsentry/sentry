// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface OrganizationAlertRuleAvailableActionIndexResponse {
  // No response keys detected — fill in manually
}

type TQueryData = ApiResponse<OrganizationAlertRuleAvailableActionIndexResponse>;
type TData = OrganizationAlertRuleAvailableActionIndexResponse;

/**
 * @public
 * Fetches actions that an alert rule can perform for an organization
 */
export function organizationAlertRuleAvailableActionIndexOptions(
  organization: Organization
) {
  return queryOptions({
    queryKey: getQueryKey(
      '/organizations/$organizationIdOrSlug/alert-rules/available-actions/',
      {
        path: {organizationIdOrSlug: organization.slug},
      }
    ),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
