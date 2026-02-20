// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface ProjectFiltersResponse {
  // No response keys detected — fill in manually
}

type TQueryData = ApiResponse<ProjectFiltersResponse>;
type TData = ProjectFiltersResponse;

/**
 * @public
 * Retrieve a list of filters for a given project.
 *         `active` will be either a boolean or a list for the legacy browser filters.
 */
export function projectFiltersOptions(organization: Organization, project: Project) {
  return queryOptions({
    queryKey: getQueryKey('/projects/$organizationIdOrSlug/$projectIdOrSlug/filters/', {
      path: {organizationIdOrSlug: organization.slug, projectIdOrSlug: project.slug},
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
