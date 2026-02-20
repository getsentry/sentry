// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';
import type {MutableSearch} from 'sentry/utils/tokenizeSearch';

// TODO: define response shape from the Python endpoint source
interface ArtifactBundlesResponse {
  // No response keys detected — fill in manually
}

interface ArtifactBundlesQueryParams {
  query?: string | MutableSearch;
  sortBy?: string;
}

type TQueryData = ApiResponse<ArtifactBundlesResponse>;
type TData = ArtifactBundlesResponse;

/**
 * @public
 * List a Project's Artifact Bundles
 *         ````````````````````````````````````
 *
 *         Retrieve a list of artifact bundles for a given project.
 *
 *         :pparam string organization_id_or_slug: the id or slug of the organization the
 *                                           artifact bundle belongs to.
 *         :pparam string project_id_or_slug: the id or slug of the project to list the
 *                                      artifact bundles of.
 */
export function artifactBundlesOptions(
  organization: Organization,
  project: Project,
  query?: ArtifactBundlesQueryParams
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
      '/projects/$organizationIdOrSlug/$projectIdOrSlug/files/artifact-bundles/',
      {
        path: {organizationIdOrSlug: organization.slug, projectIdOrSlug: project.slug},
        query: serializedQuery,
      }
    ),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
