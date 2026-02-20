// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import type {Team} from 'sentry/types/team';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: verify these types against the Python endpoint source
interface TeamTimeToResolutionResponse {
  detail: unknown;
}

interface TeamTimeToResolutionQueryParams {
  end?: string;
  environment?: string;
  start?: string;
  statsPeriod?: string;
  utc?: string;
}

type TQueryData = ApiResponse<TeamTimeToResolutionResponse>;
type TData = TeamTimeToResolutionResponse;

/**
 * @public
 * Return a a time bucketed list of mean group resolution times for a given team.
 */
export function teamTimeToResolutionOptions(
  organization: Organization,
  team: Team,
  query?: TeamTimeToResolutionQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey(
      '/teams/$organizationIdOrSlug/$teamIdOrSlug/time-to-resolution/',
      {
        path: {organizationIdOrSlug: organization.slug, teamIdOrSlug: team.slug},
        query,
      }
    ),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
