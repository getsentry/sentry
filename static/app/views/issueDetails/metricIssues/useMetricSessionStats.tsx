import type {SessionApiResponse} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {
  type ApiQueryKey,
  useApiQuery,
  type UseApiQueryOptions,
} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import type {TimePeriodType} from 'sentry/views/alerts/rules/metric/details/constants';
import {
  getPeriodInterval,
  getViableDateRange,
} from 'sentry/views/alerts/rules/metric/details/utils';
import type {MetricRule} from 'sentry/views/alerts/rules/metric/types';
import {SESSION_AGGREGATE_TO_FIELD} from 'sentry/views/alerts/utils';

interface MetricSessionStatsParams {
  project: Project;
  rule: MetricRule;
  timePeriod: TimePeriodType;
}

export function useMetricSessionStats(
  {project, rule, timePeriod}: MetricSessionStatsParams,
  options: Partial<UseApiQueryOptions<SessionApiResponse>> = {}
) {
  const organization = useOrganization();
  const {aggregate, query, environment} = rule;
  const interval = getPeriodInterval(timePeriod, rule);
  const {start: viableStartDate, end: viableEndDate} = getViableDateRange({
    rule,
    interval,
    timePeriod,
  });

  const queryKey: ApiQueryKey = [
    `/organizations/${organization.slug}/sessions/`,
    {
      query: {
        project: project.id ? [Number(project.id)] : [],
        environment,
        field: SESSION_AGGREGATE_TO_FIELD[aggregate],
        query,
        groupBy: ['session.status'],
        start: viableStartDate,
        end: viableEndDate,
        interval,
      },
    },
  ];

  return useApiQuery<SessionApiResponse>(queryKey, {
    staleTime: 0,
    ...options,
  });
}
