// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface ProjectStatsResponse {
  // No response keys detected — fill in manually
}

interface ProjectStatsQueryParams {
  /** An explicit resolution to search for (one of `10s`, `1h`, and `1d`). */
  resolution?: '10s' | '1h' | '1d';
  /** A timestamp to set the start of the query in seconds since UNIX epoch. */
  since?: string;
  /** The name of the stat to query `("received", "rejected", "blacklisted", "generated")`. */
  stat?: 'received' | 'rejected' | 'blacklisted' | 'generated';
  /** A timestamp to set the end of the query in seconds since UNIX epoch. */
  until?: string;
}

type TQueryData = ApiResponse<ProjectStatsResponse>;
type TData = ProjectStatsResponse;

/**
 * @public
 * Retrieve Event Counts for a Project
 *         ```````````````````````````````````
 *
 *         .. caution::
 *            This endpoint may change in the future without notice.
 *
 *         Return a set of points representing a normalized timestamp and the
 *         number of events seen in the period.
 *
 *         Query ranges are limited to Sentry's configured time-series
 *         resolutions.
 *
 *         :pparam string organization_id_or_slug: the id or slug of the organization.
 *         :pparam string project_id_or_slug: the id or slug of the project.
 *         :qparam string stat: the name of the stat to query (``"received"``,
 *                              ``"rejected"``, ``"blacklisted"``, ``generated``)
 *         :qparam timestamp since: a timestamp to set the start of the query
 *                                  in seconds since UNIX epoch.
 *         :qparam timestamp until: a timestamp to set the end of the query
 *                                  in seconds since UNIX epoch.
 *         :qparam string resolution: an explicit resolution to search
 *                                    for (one of ``10s``, ``1h``, and ``1d``)
 *         :auth: required
 */
export function projectStatsOptions(
  organization: Organization,
  project: Project,
  query?: ProjectStatsQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey('/projects/$organizationIdOrSlug/$projectIdOrSlug/stats/', {
      path: {organizationIdOrSlug: organization.slug, projectIdOrSlug: project.slug},
      query,
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
