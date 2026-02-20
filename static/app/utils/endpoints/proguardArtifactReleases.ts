// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: verify these types against the Python endpoint source
interface ProguardArtifactReleasesResponse {
  releases: unknown;
}

interface ProguardArtifactReleasesQueryParams {
  proguard_uuid?: string;
}

type TQueryData = ApiResponse<ProguardArtifactReleasesResponse>;
type TData = ProguardArtifactReleasesResponse;

/**
 * @public
 * List a Project's Proguard Associated Releases
 *         ````````````````````````````````````````
 *
 *         Retrieve a list of associated releases for a given Proguard File.
 *
 *         :pparam string organization_id_or_slug: the id or slug of the organization the
 *                                           file belongs to.
 *         :pparam string project_id_or_slug: the id or slug of the project to list the
 *                                      DIFs of.
 *         :qparam string proguard_uuid: the uuid of the Proguard file.
 *         :auth: required
 */
export function proguardArtifactReleasesOptions(
  organization: Organization,
  project: Project,
  query?: ProguardArtifactReleasesQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey(
      '/projects/$organizationIdOrSlug/$projectIdOrSlug/files/proguard-artifact-releases',
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
