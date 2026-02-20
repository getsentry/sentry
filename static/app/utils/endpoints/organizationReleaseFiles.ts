// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface OrganizationReleaseFilesResponse {
  // No response keys detected — fill in manually
}

type TQueryData = ApiResponse<OrganizationReleaseFilesResponse>;
type TData = OrganizationReleaseFilesResponse;

/**
 * @public
 * List an Organization Release's Files
 *         ````````````````````````````````````
 *
 *         Retrieve a list of files for a given release.
 *
 *         :pparam string organization_id_or_slug: the id or slug of the organization the
 *                                           release belongs to.
 *         :pparam string version: the version identifier of the release.
 *         :qparam string query: If set, only files with these partial names will be returned.
 *         :qparam string checksum: If set, only files with these exact checksums will be returned.
 *         :auth: required
 */
export function organizationReleaseFilesOptions(
  organization: Organization,
  version: string
) {
  return queryOptions({
    queryKey: getQueryKey(
      '/organizations/$organizationIdOrSlug/releases/$version/files/',
      {
        path: {organizationIdOrSlug: organization.slug, version},
      }
    ),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
