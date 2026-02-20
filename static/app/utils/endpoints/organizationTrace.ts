// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface OrganizationTraceResponse {
  // No response keys detected — fill in manually
}

interface OrganizationTraceQueryParams {
  additional_attributes?: string[];
  end?: string;
  environment?: string;
  errorId?: string;
  include_uptime?: string;
  project?: string;
  start?: string;
  statsPeriod?: string;
}

type TQueryData = ApiResponse<OrganizationTraceResponse>;
type TData = OrganizationTraceResponse;

/** @public */
export function organizationTraceOptions(
  organization: Organization,
  traceId: string,
  query?: OrganizationTraceQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey('/organizations/$organizationIdOrSlug/trace/$traceId/', {
      path: {organizationIdOrSlug: organization.slug, traceId},
      query,
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
