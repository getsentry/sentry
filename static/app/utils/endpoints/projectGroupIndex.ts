// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';
import type {MutableSearch} from 'sentry/utils/tokenizeSearch';

// TODO: verify these types against the Python endpoint source
interface ProjectGroupIndexResponse {
  detail: unknown;
}

interface ProjectGroupIndexQueryParams {
  /** A pointer to the last object fetched and its sort order; used to retrieve the next or previous results. */
  cursor?: string;
  /** A list of hashes of groups to return. Is not compatible with 'query' parameter. The maximum number of hashes that can be */
  hashes?: string;
  /** An optional Sentry structured search query. If not provided an implied `"is:unresolved"` is assumed. */
  query?: string | MutableSearch;
  /** If this is set to true then short IDs are looked up by this function as well. This can cause the return value of the fun */
  shortIdLookup?: boolean;
  /** An optional stat period (can be one of `"24h"`, `"14d"`, and `""`), defaults to "24h" if not provided. */
  statsPeriod?: string;
}

type TQueryData = ApiResponse<ProjectGroupIndexResponse>;
type TData = ProjectGroupIndexResponse;

/**
 * @public
 * List a Project's Issues
 *         ```````````````````````
 *         **Deprecated**: This endpoint has been replaced with the [Organization
 *         Issues endpoint](/api/events/list-an-organizations-issues/) which
 *         supports filtering on project and additional functionality.
 *
 *         Return a list of issues (groups) bound to a project.  All parameters are
 *         supplied as query string parameters.
 *
 *         A default query of ``is:unresolved`` is applied. To return results
 *         with other statuses send an new query value (i.e. ``?query=`` for all
 *         results).
 *
 *         The ``statsPeriod`` parameter can be used to select the timeline
 *         stats which should be present. Possible values are: ``""`` (disable),
 *         ``"24h"``, ``"14d"``
 *
 *         :qparam string statsPeriod: an optional stat period (can be one of
 *                                     ``"24h"``, ``"14d"``, and ``""``).
 *         :qparam bool shortIdLookup: if this is set to true then short IDs are
 *                                     looked up by this function as well.  This
 *                                     can cause the return value of the function
 *                                     to return an event issue of a different
 *                                     project which is why this is an opt-in.
 *                                     Set to `1` to enable.
 *         :qparam querystring query: an optional Sentry structured search
 *                                    query.  If not provided an implied
 *                                    ``"is:unresolved"`` is assumed.)
 *         :qparam string environment: this restricts the issues to ones containing
 *                                     events from this environment
 *         :qparam list hashes: hashes of groups to return, overrides 'query' parameter, only returning list of groups found from hashes. The maximum number of hashes that can be sent is 100. If more are sent, only the first 100 will be used.
 *         :pparam string organization_id_or_slug: the id or slug of the organization the
 *                                           issues belong to.
 *         :pparam string project_id_or_slug: the id or slug of the project the issues
 *                                      belong to.
 *         :auth: required
 */
export function projectGroupIndexOptions(
  organization: Organization,
  project: Project,
  query?: ProjectGroupIndexQueryParams
) {
  const {query: queryParam, ...restQuery} = query ?? {};
  const serializedQuery = {
    ...restQuery,
    ...(queryParam === undefined
      ? {}
      : {query: typeof queryParam === 'string' ? queryParam : queryParam.formatString()}),
  };

  return queryOptions({
    queryKey: getQueryKey('/projects/$organizationIdOrSlug/$projectIdOrSlug/issues/', {
      path: {organizationIdOrSlug: organization.slug, projectIdOrSlug: project.slug},
      query: serializedQuery,
    }),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
