// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface OrganizationReleaseCommitsResponse {
  // No response keys detected — fill in manually
}

interface OrganizationReleaseCommitsQueryParams {
  project?: string;
}

type TQueryData = ApiResponse<OrganizationReleaseCommitsResponse>;
type TData = OrganizationReleaseCommitsResponse;

/**
 * @public
 * List an Organization Release's Commits
 *         ``````````````````````````````````````
 *
 *         Retrieve a list of commits for a given release.
 *
 *         :pparam string organization_id_or_slug: the id or slug of the organization the
 *                                           release belongs to.
 *         :pparam string version: the version identifier of the release.
 *         :auth: required
 */
export function organizationReleaseCommitsOptions(
  organization: Organization,
  version: string,
  query?: OrganizationReleaseCommitsQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey(
      '/organizations/$organizationIdOrSlug/releases/$version/commits/',
      {
        path: {organizationIdOrSlug: organization.slug, version},
        query,
      }
    ),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
