// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: verify these types against the Python endpoint source
interface OrganizationOnDemandRuleStatsResponse {
  maxAllowed: unknown;
  totalOnDemandAlertSpecs: unknown;
}

interface OrganizationOnDemandRuleStatsQueryParams {
  project?: string;
  project_id?: string;
}

type TQueryData = ApiResponse<OrganizationOnDemandRuleStatsResponse>;
type TData = OrganizationOnDemandRuleStatsResponse;

/**
 * @public
 * Returns the total number of on-demand alert rules for a project, along with
 *         the maximum allowed limit of on-demand alert rules that can be created.
 */
export function organizationOnDemandRuleStatsOptions(
  organization: Organization,
  query?: OrganizationOnDemandRuleStatsQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey('/organizations/$organizationIdOrSlug/ondemand-rules-stats/', {
      path: {organizationIdOrSlug: organization.slug},
      query,
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
