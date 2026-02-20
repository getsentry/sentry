// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface OrganizationReleaseFileDetailsResponse {
  // No response keys detected — fill in manually
}

interface OrganizationReleaseFileDetailsQueryParams {
  /** If this is set to true, then the response payload will be the raw file contents. Otherwise, the response will be the fil */
  download?: boolean;
}

type TQueryData = ApiResponse<OrganizationReleaseFileDetailsResponse>;
type TData = OrganizationReleaseFileDetailsResponse;

/**
 * @public
 * Retrieve an Organization Release's File
 *         ```````````````````````````````````````
 *
 *         Return details on an individual file within a release.  This does
 *         not actually return the contents of the file, just the associated
 *         metadata.
 *
 *         :pparam string organization_id_or_slug: the id or slug of the organization the
 *                                           release belongs to.
 *         :pparam string version: the version identifier of the release.
 *         :pparam string file_id: the ID of the file to retrieve.
 *         :auth: required
 */
export function organizationReleaseFileDetailsOptions(
  organization: Organization,
  version: string,
  fileId: string,
  query?: OrganizationReleaseFileDetailsQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey(
      '/organizations/$organizationIdOrSlug/releases/$version/files/$fileId/',
      {
        path: {organizationIdOrSlug: organization.slug, version, fileId},
        query,
      }
    ),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
