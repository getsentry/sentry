// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: verify these types against the Python endpoint source
interface OrganizationAttributeMappingsResponse {
  data: unknown;
  detail: unknown;
}

interface OrganizationAttributeMappingsQueryParams {
  type?: string[];
}

type TQueryData = ApiResponse<OrganizationAttributeMappingsResponse>;
type TData = OrganizationAttributeMappingsResponse;

/** @public */
export function organizationAttributeMappingsOptions(
  organization: Organization,
  query?: OrganizationAttributeMappingsQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey('/organizations/$organizationIdOrSlug/attribute-mappings/', {
      path: {organizationIdOrSlug: organization.slug},
      query,
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
