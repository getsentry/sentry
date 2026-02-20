// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface OrganizationProjectTemplatesIndexResponse {
  // No response keys detected — fill in manually
}

type TQueryData = ApiResponse<OrganizationProjectTemplatesIndexResponse>;
type TData = OrganizationProjectTemplatesIndexResponse;

/**
 * @public
 * List of Project Templates, does not include the options for the project template.
 *
 *         Return a list of project templates available to the authenticated user.
 */
export function organizationProjectTemplatesIndexOptions(organization: Organization) {
  return queryOptions({
    queryKey: getQueryKey('/organizations/$organizationIdOrSlug/project-templates/', {
      path: {organizationIdOrSlug: organization.slug},
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
