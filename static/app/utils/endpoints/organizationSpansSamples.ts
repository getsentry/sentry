// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface OrganizationSpansSamplesResponse {
  // No response keys detected — fill in manually
}

interface OrganizationSpansSamplesQueryParams {
  dataset?: string;
  end?: string;
  environment?: string;
  project?: string;
  start?: string;
  statsPeriod?: string;
}

type TQueryData = ApiResponse<OrganizationSpansSamplesResponse>;
type TData = OrganizationSpansSamplesResponse;

/** @public */
export function organizationSpansSamplesOptions(
  organization: Organization,
  query?: OrganizationSpansSamplesQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey('/organizations/$organizationIdOrSlug/spans-samples/', {
      path: {organizationIdOrSlug: organization.slug},
      query,
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
