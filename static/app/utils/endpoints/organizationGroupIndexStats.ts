// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface OrganizationGroupIndexStatsResponse {
  // No response keys detected — fill in manually
}

interface OrganizationGroupIndexStatsQueryParams {
  collapse?: string[];
  environment?: string;
  expand?: string[];
  groupStatsPeriod?: string;
  groups?: string[];
  project?: string;
}

type TQueryData = ApiResponse<OrganizationGroupIndexStatsResponse>;
type TData = OrganizationGroupIndexStatsResponse;

/**
 * @public
 * Get the stats on an Organization's Issues
 *         `````````````````````````````
 *         Return a list of issues (groups) with the requested stats.  All parameters are
 *         supplied as query string parameters.
 *
 *         :qparam list groups: A list of group ids
 *         :qparam list expand: an optional list of strings to opt in to additional data. Supports `inbox`
 *         :qparam list collapse: an optional list of strings to opt out of certain pieces of data. Supports `stats`, `lifetime`, `filtered`, and `base`
 *
 *         The ``groupStatsPeriod`` parameter can be used to select the timeline
 *         stats which should be present. Possible values are: '' (disable),
 *         '24h', '14d'
 *
 *         The ``statsPeriod`` parameter can be used to select a date window starting
 *         from now. Ex. ``14d``.
 *
 *         The ``start`` and ``end`` parameters can be used to select an absolute
 *         date period to fetch issues from.
 *
 *         :qparam string statsPeriod: an optional stat period (can be one of
 *                                     ``"24h"``, ``"14d"``, and ``""``).
 *         :qparam string groupStatsPeriod: an optional stat period (can be one of
 *                                     ``"24h"``, ``"14d"``, and ``""``).
 *         :qparam string start:       Beginning date. You must also provide ``end``.
 *         :qparam string end:         End date. You must also provide ``start``.
 */
export function organizationGroupIndexStatsOptions(
  organization: Organization,
  query?: OrganizationGroupIndexStatsQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey('/organizations/$organizationIdOrSlug/issues-stats/', {
      path: {organizationIdOrSlug: organization.slug},
      query,
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
