// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface OrganizationSpansFieldsResponse {
  // No response keys detected — fill in manually
}

interface OrganizationSpansFieldsQueryParams {
  end?: string;
  environment?: string;
  project?: string;
  start?: string;
  statsPeriod?: string;
  type?: 'string' | 'number' | 'boolean';
}

type TQueryData = ApiResponse<OrganizationSpansFieldsResponse>;
type TData = OrganizationSpansFieldsResponse;

/** @public */
export function organizationSpansFieldsOptions(
  organization: Organization,
  query?: OrganizationSpansFieldsQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey('/organizations/$organizationIdOrSlug/spans/fields/', {
      path: {organizationIdOrSlug: organization.slug},
      query,
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
