// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface ProjectCodeOwnersResponse {
  // No response keys detected — fill in manually
}

interface ProjectCodeOwnersQueryParams {
  expand?: string[];
}

type TQueryData = ApiResponse<ProjectCodeOwnersResponse>;
type TData = ProjectCodeOwnersResponse;

/**
 * @public
 * Retrieve the list of CODEOWNERS configurations for a project
 *         ````````````````````````````````````````````
 *
 *         Return a list of a project's CODEOWNERS configuration.
 *
 *         :auth: required
 */
export function projectCodeOwnersOptions(
  organization: Organization,
  project: Project,
  query?: ProjectCodeOwnersQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey(
      '/projects/$organizationIdOrSlug/$projectIdOrSlug/codeowners/',
      {
        path: {organizationIdOrSlug: organization.slug, projectIdOrSlug: project.slug},
        query,
      }
    ),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
