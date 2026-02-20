// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface OrganizationStatsResponse {
  // No response keys detected — fill in manually
}

interface OrganizationStatsQueryParams {
  group?: string;
  id?: string[];
  projectID?: string[];
  stat?: string;
}

type TQueryData = ApiResponse<OrganizationStatsResponse>;
type TData = OrganizationStatsResponse;

/**
 * @public
 * Retrieve Event Counts for an Organization
 *         `````````````````````````````````````````
 *
 *         .. caution::
 *            This endpoint may change in the future without notice.
 *
 *         Return a set of points representing a normalized timestamp and the
 *         number of events seen in the period.
 *
 *         :pparam string organization_id_or_slug: the id or slug of the organization for
 *                                           which the stats should be
 *                                           retrieved.
 *         :qparam string stat: the name of the stat to query (``"received"``,
 *                              ``"rejected"``, ``"blacklisted"``)
 *         :qparam timestamp since: a timestamp to set the start of the query
 *                                  in seconds since UNIX epoch.
 *         :qparam timestamp until: a timestamp to set the end of the query
 *                                  in seconds since UNIX epoch.
 *         :qparam string resolution: an explicit resolution to search
 *                                    for (one of ``10s``, ``1h``, and ``1d``)
 *         :auth: required
 */
export function organizationStatsOptions(
  organization: Organization,
  query?: OrganizationStatsQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey('/organizations/$organizationIdOrSlug/stats/', {
      path: {organizationIdOrSlug: organization.slug},
      query,
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
