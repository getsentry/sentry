// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface OrganizationProjectsSentFirstEventResponse {
  // No response keys detected — fill in manually
}

interface OrganizationProjectsSentFirstEventQueryParams {
  project?: string;
}

type TQueryData = ApiResponse<OrganizationProjectsSentFirstEventResponse>;
type TData = OrganizationProjectsSentFirstEventResponse;

/**
 * @public
 * Verify If Any Project Within An Organization Has Received a First Event
 *         ```````````````````````````````````````````````````````````````````````
 *
 *         Returns true if any projects within the organization have received
 *         a first event, false otherwise.
 *
 *         :pparam string organization_id_or_slug: the id or slug of the organization
 *                                           containing the projects to check
 *                                           for a first event from.
 *         :qparam array[string] project:    An optional list of project ids to filter
 *         :auth: required
 */
export function organizationProjectsSentFirstEventOptions(
  organization: Organization,
  query?: OrganizationProjectsSentFirstEventQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey('/organizations/$organizationIdOrSlug/sent-first-event/', {
      path: {organizationIdOrSlug: organization.slug},
      query,
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
