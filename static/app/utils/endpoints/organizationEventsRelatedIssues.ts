// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: verify these types against the Python endpoint source
interface OrganizationEventsRelatedIssuesResponse {
  detail: unknown;
}

interface OrganizationEventsRelatedIssuesQueryParams {
  end?: string;
  environment?: string;
  project?: string;
  start?: string;
  statsPeriod?: string;
}

type TQueryData = ApiResponse<OrganizationEventsRelatedIssuesResponse>;
type TData = OrganizationEventsRelatedIssuesResponse;

/** @public */
export function organizationEventsRelatedIssuesOptions(
  organization: Organization,
  query?: OrganizationEventsRelatedIssuesQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey('/organizations/$organizationIdOrSlug/related-issues/', {
      path: {organizationIdOrSlug: organization.slug},
      query,
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
