// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface OrganizationWorkflowStatsResponse {
  // No response keys detected — fill in manually
}

interface OrganizationWorkflowStatsQueryParams {
  end?: string;
  start?: string;
  statsPeriod?: string;
  utc?: string;
}

type TQueryData = ApiResponse<OrganizationWorkflowStatsResponse>;
type TData = OrganizationWorkflowStatsResponse;

/**
 * @public
 * Note that results are returned in hourly buckets.
 */
export function organizationWorkflowStatsOptions(
  organization: Organization,
  workflowId: string,
  query?: OrganizationWorkflowStatsQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey(
      '/organizations/$organizationIdOrSlug/workflows/$workflowId/stats/',
      {
        path: {organizationIdOrSlug: organization.slug, workflowId},
        query,
      }
    ),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
