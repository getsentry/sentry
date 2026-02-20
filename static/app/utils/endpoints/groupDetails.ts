// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface GroupDetailsResponse {
  // No response keys detected — fill in manually
}

interface GroupDetailsQueryParams {
  collapse?: string[];
  environment?: string;
  expand?: string[];
}

type TQueryData = ApiResponse<GroupDetailsResponse>;
type TData = GroupDetailsResponse;

/**
 * @public
 * Retrieve an Issue
 *         `````````````````
 *
 *         Return details on an individual issue. This returns the basic stats for
 *         the issue (title, last seen, first seen), some overall numbers (number
 *         of comments, user reports) as well as the summarized event data.
 *
 *         :pparam string organization_id_or_slug: the id or slug of the organization.
 *         :pparam string issue_id: the ID of the issue to retrieve.
 *         :auth: required
 */
export function groupDetailsOptions(
  organization: Organization,
  issueId: string,
  query?: GroupDetailsQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey('/organizations/$organizationIdOrSlug/issues/$issueId/', {
      path: {organizationIdOrSlug: organization.slug, issueId},
      query,
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
