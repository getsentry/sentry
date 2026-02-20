// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface OrganizationEventsTraceMetaResponse {
  // No response keys detected — fill in manually
}

interface OrganizationEventsTraceMetaQueryParams {
  end?: string;
  environment?: string;
  project?: string;
  start?: string;
  statsPeriod?: string;
}

type TQueryData = ApiResponse<OrganizationEventsTraceMetaResponse>;
type TData = OrganizationEventsTraceMetaResponse;

/** @public */
export function organizationEventsTraceMetaOptions(
  organization: Organization,
  traceId: string,
  query?: OrganizationEventsTraceMetaQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey(
      '/organizations/$organizationIdOrSlug/events-trace-meta/$traceId/',
      {
        path: {organizationIdOrSlug: organization.slug, traceId},
        query,
      }
    ),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
