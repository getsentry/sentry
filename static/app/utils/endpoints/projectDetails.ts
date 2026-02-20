// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface ProjectDetailsResponse {
  // No response keys detected — fill in manually
}

interface ProjectDetailsQueryParams {
  expand?: string[];
  include?: string;
}

type TQueryData = ApiResponse<ProjectDetailsResponse>;
type TData = ProjectDetailsResponse;

/**
 * @public
 * Return details on an individual project.
 */
export function projectDetailsOptions(
  organization: Organization,
  project: Project,
  query?: ProjectDetailsQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey('/projects/$organizationIdOrSlug/$projectIdOrSlug/', {
      path: {organizationIdOrSlug: organization.slug, projectIdOrSlug: project.slug},
      query,
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
