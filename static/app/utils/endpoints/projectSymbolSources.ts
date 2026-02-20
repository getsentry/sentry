// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface ProjectSymbolSourcesResponse {
  // No response keys detected — fill in manually
}

interface ProjectSymbolSourcesQueryParams {
  /** The ID of the source to look up. If this is not provided, all sources are returned. */
  id?: string;
}

type TQueryData = ApiResponse<ProjectSymbolSourcesResponse>;
type TData = ProjectSymbolSourcesResponse;

/**
 * @public
 * List custom symbol sources configured for a project.
 */
export function projectSymbolSourcesOptions(
  organization: Organization,
  project: Project,
  query?: ProjectSymbolSourcesQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey(
      '/projects/$organizationIdOrSlug/$projectIdOrSlug/symbol-sources/',
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
