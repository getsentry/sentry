// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface ProjectRuleStatsIndexResponse {
  // No response keys detected — fill in manually
}

interface ProjectRuleStatsIndexQueryParams {
  end?: string;
  start?: string;
  statsPeriod?: string;
  utc?: string;
}

type TQueryData = ApiResponse<ProjectRuleStatsIndexResponse>;
type TData = ProjectRuleStatsIndexResponse;

/**
 * @public
 * Note that results are returned in hourly buckets.
 */
export function projectRuleStatsIndexOptions(
  organization: Organization,
  project: Project,
  ruleId: string,
  query?: ProjectRuleStatsIndexQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey(
      '/projects/$organizationIdOrSlug/$projectIdOrSlug/rules/$ruleId/stats/',
      {
        path: {
          organizationIdOrSlug: organization.slug,
          projectIdOrSlug: project.slug,
          ruleId,
        },
        query,
      }
    ),
    queryFn: apiFetch,
    select: (data: TQueryData): TData => data.json,
    staleTime: 0, // TODO: set appropriate stale time
  });
}
