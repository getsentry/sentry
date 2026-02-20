// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface OrganizationIssuesResolvedInReleaseResponse {
  // No response keys detected — fill in manually
}

interface OrganizationIssuesResolvedInReleaseQueryParams {
  environment?: string;
  project?: string;
}

type TQueryData = ApiResponse<OrganizationIssuesResolvedInReleaseResponse>;
type TData = OrganizationIssuesResolvedInReleaseResponse;

/**
 * @public
 * List issues to be resolved in a particular release
 *         ``````````````````````````````````````````````````
 *
 *         Retrieve a list of issues to be resolved in a given release.
 *
 *         :pparam string organization_id_or_slug: the id or slug of the organization the
 *                                           release belongs to.
 *         :pparam string version: the version identifier of the release.
 *         :auth: required
 */
export function organizationIssuesResolvedInReleaseOptions(
  organization: Organization,
  version: string,
  query?: OrganizationIssuesResolvedInReleaseQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey(
      '/organizations/$organizationIdOrSlug/releases/$version/resolved/',
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
