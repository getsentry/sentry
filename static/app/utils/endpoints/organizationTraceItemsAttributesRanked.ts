// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: verify these types against the Python endpoint source
interface OrganizationTraceItemsAttributesRankedResponse {
  rankedAttributes: unknown;
}

interface OrganizationTraceItemsAttributesRankedQueryParams {
  above?: string;
  end?: string;
  environment?: string;
  function?: string;
  project?: string;
  query_1?: string;
  query_2?: string;
  start?: string;
  statsPeriod?: string;
}

type TQueryData = ApiResponse<OrganizationTraceItemsAttributesRankedResponse>;
type TData = OrganizationTraceItemsAttributesRankedResponse;

/** @public */
export function organizationTraceItemsAttributesRankedOptions(
  organization: Organization,
  query?: OrganizationTraceItemsAttributesRankedQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey(
      '/organizations/$organizationIdOrSlug/trace-items/attributes/ranked/',
      {
        path: {organizationIdOrSlug: organization.slug},
        query,
      }
    ),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
