// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface OrganizationTagsResponse {
  // No response keys detected — fill in manually
}

interface OrganizationTagsQueryParams {
  dataset?: string;
  end?: string;
  environment?: string;
  project?: string;
  start?: string;
  statsPeriod?: string;
  useFlagsBackend?: string;
  use_cache?: string;
}

type TQueryData = ApiResponse<OrganizationTagsResponse>;
type TData = OrganizationTagsResponse;

/** @public */
export function organizationTagsOptions(
  organization: Organization,
  query?: OrganizationTagsQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey('/organizations/$organizationIdOrSlug/tags/', {
      path: {organizationIdOrSlug: organization.slug},
      query,
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
