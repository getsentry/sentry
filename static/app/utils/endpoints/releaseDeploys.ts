// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface ReleaseDeploysResponse {
  // No response keys detected — fill in manually
}

interface ReleaseDeploysQueryParams {
  project?: string;
}

type TQueryData = ApiResponse<ReleaseDeploysResponse>;
type TData = ReleaseDeploysResponse;

/**
 * @public
 * Returns a list of deploys based on the organization, version, and project.
 */
export function releaseDeploysOptions(
  organization: Organization,
  version: string,
  query?: ReleaseDeploysQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey(
      '/organizations/$organizationIdOrSlug/releases/$version/deploys/',
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
