// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface OrganizationUserReportsResponse {
  // No response keys detected — fill in manually
}

interface OrganizationUserReportsQueryParams {
  end?: string;
  environment?: string;
  project?: string;
  start?: string;
  statsPeriod?: string;
  status?: string;
}

type TQueryData = ApiResponse<OrganizationUserReportsResponse>;
type TData = OrganizationUserReportsResponse;

/**
 * @public
 * List an Organization's User Feedback
 *         ``````````````````````````````
 *
 *         Return a list of user feedback items within this organization. Can be
 *         filtered by projects/environments/creation date.
 *
 *         :pparam string organization_id_or_slug: the id or slug of the organization.
 *         :pparam string project_id_or_slug: the id or slug of the project.
 *         :auth: required
 */
export function organizationUserReportsOptions(
  organization: Organization,
  query?: OrganizationUserReportsQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey('/organizations/$organizationIdOrSlug/user-feedback/', {
      path: {organizationIdOrSlug: organization.slug},
      query,
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
