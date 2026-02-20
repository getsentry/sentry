// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: verify these types against the Python endpoint source
interface OrganizationReleaseMetaResponse {
  commitCount: number;
  commitFilesChanged: unknown;
  deployCount: number;
  isArtifactBundle: boolean;
  newGroups: unknown;
  preprodBuildCount: number;
  projects: unknown;
  releaseFileCount: number;
  released: unknown;
  version: string;
  versionInfo: unknown;
}

type TQueryData = ApiResponse<OrganizationReleaseMetaResponse>;
type TData = OrganizationReleaseMetaResponse;

/**
 * @public
 * Retrieve an Organization's Release's Associated Meta Data
 *         `````````````````````````````````````````````````````````
 *
 *         The data returned from here is auxiliary meta data that the UI uses.
 *
 *         :pparam string organization_id_or_slug: the id or slug of the organization the
 *                                           release belongs to.
 *         :pparam string version: the version identifier of the release.
 *         :auth: required
 */
export function organizationReleaseMetaOptions(
  organization: Organization,
  version: string
) {
  return queryOptions({
    queryKey: getQueryKey(
      '/organizations/$organizationIdOrSlug/releases/$version/meta/',
      {
        path: {organizationIdOrSlug: organization.slug, version},
      }
    ),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
