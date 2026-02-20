// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface OrganizationSdkUpdatesResponse {
  // No response keys detected — fill in manually
}

interface OrganizationSdkUpdatesQueryParams {
  project?: string;
}

type TQueryData = ApiResponse<OrganizationSdkUpdatesResponse>;
type TData = OrganizationSdkUpdatesResponse;

/** @public */
export function organizationSdkUpdatesOptions(
  organization: Organization,
  query?: OrganizationSdkUpdatesQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey('/organizations/$organizationIdOrSlug/sdk-updates/', {
      path: {organizationIdOrSlug: organization.slug},
      query,
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
