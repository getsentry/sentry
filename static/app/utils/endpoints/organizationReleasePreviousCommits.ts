// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface OrganizationReleasePreviousCommitsResponse {
  // No response keys detected — fill in manually
}

interface OrganizationReleasePreviousCommitsQueryParams {
  end?: string;
  environment?: string;
  project?: string;
  start?: string;
  statsPeriod?: string;
}

type TQueryData = ApiResponse<OrganizationReleasePreviousCommitsResponse>;
type TData = OrganizationReleasePreviousCommitsResponse;

/**
 * @public
 * Retrieve an Organization's Most Recent Release with Commits
 *         ````````````````````````````````````````````````````````````
 *
 *         :pparam string organization_id_or_slug: the id or slug of the organization the
 *                                           release belongs to.
 *         :pparam string version: the version identifier of the release.
 *         :auth: required
 */
export function organizationReleasePreviousCommitsOptions(
  organization: Organization,
  version: string,
  query?: OrganizationReleasePreviousCommitsQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey(
      '/organizations/$organizationIdOrSlug/releases/$version/previous-with-commits/',
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
