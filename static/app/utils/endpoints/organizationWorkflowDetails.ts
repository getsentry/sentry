// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface OrganizationWorkflowDetailsResponse {
  // No response keys detected — fill in manually
}

type TQueryData = ApiResponse<OrganizationWorkflowDetailsResponse>;
type TData = OrganizationWorkflowDetailsResponse;

/**
 * @public
 * ⚠️ This endpoint is currently in **beta** and may be subject to change. It is supported by [New Monitors and Alerts](/product/new-monitors-and-alerts/) and may not be viewable in the UI today.
 *
 *         Returns an alert.
 */
export function organizationWorkflowDetailsOptions(
  organization: Organization,
  workflowId: string
) {
  return queryOptions({
    queryKey: getQueryKey('/organizations/$organizationIdOrSlug/workflows/$workflowId/', {
      path: {organizationIdOrSlug: organization.slug, workflowId},
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
