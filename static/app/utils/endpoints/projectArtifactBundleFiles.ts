// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';
import type {MutableSearch} from 'sentry/utils/tokenizeSearch';

// TODO: verify these types against the Python endpoint source
interface ProjectArtifactBundleFilesResponse {
  error: unknown;
}

interface ProjectArtifactBundleFilesQueryParams {
  query?: string | MutableSearch;
}

type TQueryData = ApiResponse<ProjectArtifactBundleFilesResponse>;
type TData = ProjectArtifactBundleFilesResponse;

/**
 * @public
 * List files for a given project artifact bundle.
 *         ``````````````````````````````
 *
 *         Retrieve a list of files for a given artifact bundle.
 *
 *         :pparam string organization_id_or_slug: the id or slug of the organization the
 *                                           artifact bundle belongs to.
 *         :pparam string project_id_or_slug: the id or slug of the project the
 *                                      artifact bundle belongs to.
 *         :pparam string bundle_id: bundle_id of the artifact bundle to list files from.
 */
export function projectArtifactBundleFilesOptions(
  organization: Organization,
  project: Project,
  bundleId: string,
  query?: ProjectArtifactBundleFilesQueryParams
) {
  const {query: queryParam, ...restQuery} = query ?? {};
  const serializedQuery = {
    ...restQuery,
    ...(queryParam === undefined
      ? {}
      : {query: typeof queryParam === 'string' ? queryParam : queryParam.formatString()}),
  };

  return queryOptions({
    queryKey: getQueryKey(
      '/projects/$organizationIdOrSlug/$projectIdOrSlug/artifact-bundles/$bundleId/files/',
      {
        path: {
          organizationIdOrSlug: organization.slug,
          projectIdOrSlug: project.slug,
          bundleId,
        },
        query: serializedQuery,
      }
    ),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
