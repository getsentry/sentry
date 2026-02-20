// GENERATED FILE. Run `python bin/generate-endpoint-options` to regenerate.
// Review and commit after filling in TODOs.

import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import apiFetch, {type ApiResponse} from 'sentry/utils/api/apiFetch';
import {getQueryKey} from 'sentry/utils/api/apiQueryKey';
import {queryOptions} from 'sentry/utils/queryClient';

// TODO: define response shape from the Python endpoint source
interface ProjectRuleGroupHistoryIndexResponse {
  // No response keys detected — fill in manually
}

interface ProjectRuleGroupHistoryIndexQueryParams {
  end?: string;
  start?: string;
  statsPeriod?: string;
  utc?: string;
}

type TQueryData = ApiResponse<ProjectRuleGroupHistoryIndexResponse>;
type TData = ProjectRuleGroupHistoryIndexResponse;

/** @public */
export function projectRuleGroupHistoryIndexOptions(
  organization: Organization,
  project: Project,
  ruleId: string,
  query?: ProjectRuleGroupHistoryIndexQueryParams
) {
  return queryOptions({
    queryKey: getQueryKey(
      '/projects/$organizationIdOrSlug/$projectIdOrSlug/rules/$ruleId/group-history/',
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
