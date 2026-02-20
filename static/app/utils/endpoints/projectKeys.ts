// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface ProjectKeysResponse {
  // No response keys detected — fill in manually
}

interface ProjectKeysQueryParams {
  /** A pointer to the last object fetched and its sort order; used to retrieve the next or previous results. */
  cursor?: string;
  /** Filter client keys by `active` or `inactive`. Defaults to returning all keys if not specified. */
  status?: string;
}

type TQueryData = ApiResponse<ProjectKeysResponse>;
type TData = ProjectKeysResponse;

/**
 * @public
 * Return a list of client keys bound to a project.
 */
export function projectKeysOptions(
  organization: Organization,
  project: Project,
  query?: ProjectKeysQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey('/projects/$organizationIdOrSlug/$projectIdOrSlug/keys/', {
      path: {organizationIdOrSlug: organization.slug, projectIdOrSlug: project.slug},
      query,
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
