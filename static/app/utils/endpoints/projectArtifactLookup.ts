// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface ProjectArtifactLookupResponse {
  // No response keys detected — fill in manually
}

interface ProjectArtifactLookupQueryParams {
  debug_id?: string;
  dist?: string;
  download?: string;
  release?: string;
  url?: string;
}

type TQueryData = ApiResponse<ProjectArtifactLookupResponse>;
type TData = ProjectArtifactLookupResponse;

/**
 * @public
 * List a Project's Individual Artifacts or Bundles
 *         ````````````````````````````````````````
 *
 *         Retrieve a list of individual artifacts or artifact bundles for a given project.
 *
 *         :pparam string organization_id_or_slug: the id or slug of the organization to query.
 *         :pparam string project_id_or_slug: the id or slug of the project to query.
 *         :qparam string debug_id: if set, will query and return the artifact
 *                                  bundle that matches the given `debug_id`.
 *         :qparam string url: if set, will query and return all the individual
 *                             artifacts, or artifact bundles that contain files
 *                             that match the `url`. This is using a substring-match.
 *         :qparam string release: used in conjunction with `url`.
 *         :qparam string dist: used in conjunction with `url`.
 *
 *         :auth: required
 */
export function projectArtifactLookupOptions(
  organization: Organization,
  project: Project,
  query?: ProjectArtifactLookupQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey(
      '/projects/$organizationIdOrSlug/$projectIdOrSlug/artifact-lookup/',
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
