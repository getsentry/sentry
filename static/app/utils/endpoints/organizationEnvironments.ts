// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: verify these types against the Python endpoint source
interface OrganizationEnvironmentsResponse {
  detail: unknown;
}

interface OrganizationEnvironmentsQueryParams {
  /** The visibility of the environments to filter by. Defaults to `visible`. */
  visibility?: 'all' | 'hidden' | 'visible';
}

type TQueryData = ApiResponse<OrganizationEnvironmentsResponse>;
type TData = OrganizationEnvironmentsResponse;

/**
 * @public
 * Lists an organization's environments.
 */
export function organizationEnvironmentsOptions(
  organization: Organization,
  query?: OrganizationEnvironmentsQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey('/organizations/$organizationIdOrSlug/environments/', {
      path: {organizationIdOrSlug: organization.slug},
      query,
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
