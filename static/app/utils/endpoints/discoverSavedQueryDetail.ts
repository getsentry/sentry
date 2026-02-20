// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface DiscoverSavedQueryDetailResponse {
  // No response keys detected — fill in manually
}

type TQueryData = ApiResponse<DiscoverSavedQueryDetailResponse>;
type TData = DiscoverSavedQueryDetailResponse;

/**
 * @public
 * Retrieve a saved query.
 */
export function discoverSavedQueryDetailOptions(
  organization: Organization,
  queryId: string
) {
  return queryOptions({
    queryKey: getQueryKey(
      '/organizations/$organizationIdOrSlug/discover/saved/$queryId/',
      {
        path: {organizationIdOrSlug: organization.slug, queryId},
      }
    ),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
