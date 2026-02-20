// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface OrganizationProjectTemplateDetailResponse {
  // No response keys detected — fill in manually
}

type TQueryData = ApiResponse<OrganizationProjectTemplateDetailResponse>;
type TData = OrganizationProjectTemplateDetailResponse;

/**
 * @public
 * Retrieve a project template by its ID.
 *
 *         Return details on an individual project template.
 */
export function organizationProjectTemplateDetailOptions(
  organization: Organization,
  templateId: string
) {
  return queryOptions({
    queryKey: getQueryKey(
      '/organizations/$organizationIdOrSlug/project-templates/$templateId/',
      {
        path: {organizationIdOrSlug: organization.slug, templateId},
      }
    ),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
