import type {EventsStats} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import type {DiscoverDatasets} from 'sentry/utils/discover/types';
import {getPeriod} from 'sentry/utils/duration/getPeriod';
import {
  type ApiQueryKey,
  useApiQuery,
  type UseApiQueryOptions,
} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import type {TimePeriodType} from 'sentry/views/alerts/rules/metric/details/constants';
import {
  getPeriodInterval,
  getViableDateRange,
} from 'sentry/views/alerts/rules/metric/details/utils';
import {Dataset, type MetricRule} from 'sentry/views/alerts/rules/metric/types';
import {extractEventTypeFilterFromRule} from 'sentry/views/alerts/rules/metric/utils/getEventTypeFilter';
import {getMetricDatasetQueryExtras} from 'sentry/views/alerts/rules/metric/utils/getMetricDatasetQueryExtras';
import {isOnDemandMetricAlert} from 'sentry/views/alerts/rules/metric/utils/onDemandMetricAlert';

interface MetricEventStatsParams {
  project: Project;
  referrer: string;
  rule: MetricRule;
  timePeriod: TimePeriodType;
}

export interface EventRequestQueryParams {
  comparisonDelta?: number;
  dataset?: DiscoverDatasets;
  end?: string;
  environment?: string[];
  excludeOther?: '1';
  field?: string[];
  interval?: string;
  orderby?: string;
  partial?: '1';
  project?: number[];
  query?: string;
  referrer?: string;
  start?: string;
  statsPeriod?: string;
  team?: string | string[];
  topEvents?: number;
  // XXX: This is the literal string 'true', not a boolean
  useOnDemandMetrics?: 'true';
  useRpc?: '1';
  withoutZerofill?: '1';
  yAxis?: string | string[];
}

export function useMetricEventStats(
  {project, rule, timePeriod, referrer}: MetricEventStatsParams,
  options: Partial<UseApiQueryOptions<EventsStats>> = {}
) {
  const organization = useOrganization();
  const location = useLocation();

  const {dataset, aggregate, query: ruleQuery, environment: ruleEnvironment} = rule;
  const interval = getPeriodInterval(timePeriod, rule);
  const isOnDemandAlert = isOnDemandMetricAlert(dataset, aggregate, ruleQuery);
  const eventType = extractEventTypeFilterFromRule(rule);

  const query =
    dataset === Dataset.EVENTS_ANALYTICS_PLATFORM
      ? ruleQuery
      : (ruleQuery ? `(${ruleQuery}) AND (${eventType})` : eventType).trim();

  const {start: viableStartDate, end: viableEndDate} = getViableDateRange({
    rule,
    interval,
    timePeriod,
  });

  const queryExtras: Record<string, string> = getMetricDatasetQueryExtras({
    organization,
    location,
    dataset,
    newAlertOrQuery: false,
    useOnDemandMetrics: isOnDemandAlert,
  });

  const queryObject: EventRequestQueryParams = Object.fromEntries(
    Object.entries({
      ...getPeriod({start: viableStartDate, end: viableEndDate}),
      interval,
      comparisonDelta: rule.comparisonDelta ? rule.comparisonDelta * 60 : undefined,
      project: project.id ? [Number(project.id)] : [],
      environment: ruleEnvironment ? [ruleEnvironment] : undefined,
      query,
      yAxis: aggregate,
      useRpc: dataset === Dataset.EVENTS_ANALYTICS_PLATFORM ? '1' : undefined,
      referrer,
      ...queryExtras,
    }).filter(([, value]) => typeof value !== 'undefined')
  );

  const queryKey: ApiQueryKey = [
    `/organizations/${organization.slug}/events-stats/`,
    {query: queryObject},
  ];

  return useApiQuery<EventsStats>(queryKey, {
    staleTime: 0,
    ...options,
  });
}
