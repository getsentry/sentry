import type {EventsStats} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import type {DiscoverDatasets} from 'sentry/utils/discover/types';
import {getPeriod} from 'sentry/utils/duration/getPeriod';
import {
  useApiQuery,
  type ApiQueryKey,
  type UseApiQueryOptions,
} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import type {TimePeriodType} from 'sentry/views/alerts/rules/metric/details/constants';
import {
  getPeriodInterval,
  getViableDateRange,
} from 'sentry/views/alerts/rules/metric/details/utils';
import {
  Dataset,
  EAP_EXTRAPOLATION_MODE_MAP,
  type MetricRule,
} from 'sentry/views/alerts/rules/metric/types';
import {extractEventTypeFilterFromRule} from 'sentry/views/alerts/rules/metric/utils/getEventTypeFilter';
import {getMetricDatasetQueryExtras} from 'sentry/views/alerts/rules/metric/utils/getMetricDatasetQueryExtras';
import {isOnDemandMetricAlert} from 'sentry/views/alerts/rules/metric/utils/onDemandMetricAlert';
import {getTraceItemTypeForDatasetAndEventType} from 'sentry/views/alerts/wizard/utils';
import type {
  RPCQueryExtras,
  SamplingMode,
} from 'sentry/views/explore/hooks/useProgressiveQuery';

interface MetricEventStatsParams {
  project: Project;
  referrer: string;
  rule: MetricRule;
  timePeriod: TimePeriodType;
}

interface EventRequestQueryParams {
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
  samplingMode?: SamplingMode;
  start?: string;
  statsPeriod?: string;
  team?: string | string[];
  topEvents?: number;
  // XXX: This is the literal string 'true', not a boolean
  useOnDemandMetrics?: 'true';
  withoutZerofill?: '1';
  yAxis?: string | string[];
}

export function useMetricEventStats(
  {
    project,
    rule,
    timePeriod,
    referrer,
    samplingMode,
  }: MetricEventStatsParams & RPCQueryExtras,
  options: Partial<UseApiQueryOptions<EventsStats>> = {}
) {
  const organization = useOrganization();
  const location = useLocation();

  const {
    dataset,
    aggregate,
    query: ruleQuery,
    environment: ruleEnvironment,
    eventTypes: storedEventTypes,
    extrapolationMode,
  } = rule;
  const traceItemType = getTraceItemTypeForDatasetAndEventType(dataset, storedEventTypes);
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
    traceItemType,
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
      referrer,
      sampling: samplingMode,
      extrapolationMode: extrapolationMode
        ? EAP_EXTRAPOLATION_MODE_MAP[extrapolationMode]
        : undefined,
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
