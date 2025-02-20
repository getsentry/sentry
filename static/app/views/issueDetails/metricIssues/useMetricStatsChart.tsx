import type {AreaChartProps} from 'sentry/components/charts/areaChart';
import {transformTimeseriesData} from 'sentry/components/charts/eventsRequest';
import type {Series} from 'sentry/types/echarts';
import type {SessionApiResponse} from 'sentry/types/organization';
import type {EventsStats} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import type {UseApiQueryOptions, UseApiQueryResult} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import {MINUTES_THRESHOLD_TO_DISPLAY_SECONDS} from 'sentry/utils/sessions';
import type {TimePeriodType} from 'sentry/views/alerts/rules/metric/details/constants';
import {
  getMetricAlertChartOption,
  transformSessionResponseToSeries,
} from 'sentry/views/alerts/rules/metric/details/metricChartOption';
import type {MetricRule} from 'sentry/views/alerts/rules/metric/types';
import {isCrashFreeAlert} from 'sentry/views/alerts/rules/metric/utils/isCrashFreeAlert';
import type {Anomaly, Incident} from 'sentry/views/alerts/types';
import {useMetricEventStats} from 'sentry/views/issueDetails/metricIssues/useMetricEventStats';
import {useMetricSessionStats} from 'sentry/views/issueDetails/metricIssues/useMetricSessionStats';

interface MetricStatsParams {
  project: Project;
  referrer: string;
  rule: MetricRule;
  timePeriod: TimePeriodType;
  anomalies?: Anomaly[];
  incidents?: Incident[];
}
type MetricStatsResponse = SessionApiResponse | EventsStats | undefined;

interface MetricStatsResult {
  chartProps: Partial<AreaChartProps>;
  data: UseApiQueryResult<MetricStatsResponse, RequestError>['data'];
  resultType: 'sessions' | 'events';
  queryResult?: Partial<UseApiQueryResult<MetricStatsResponse, RequestError>>;
}

/**
 * Helper hook to coerce any rule into returning a series data response, whether it is a session or event rule.
 * Returns a similar response to a useApiQuery hook,
 */
export function useMetricStatsChart(
  {
    project,
    rule,
    timePeriod,
    referrer,
    anomalies = [],
    incidents = [],
  }: MetricStatsParams,
  options: Partial<UseApiQueryOptions<MetricStatsResponse>> = {}
): MetricStatsResult {
  const shouldUseSessionsStats = isCrashFreeAlert(rule.dataset);
  const {data: sessionStats, ...sessionStatsResults} = useMetricSessionStats(
    {project, rule, timePeriod},
    {
      enabled: shouldUseSessionsStats,
      ...(options as Partial<UseApiQueryOptions<SessionApiResponse>>),
    }
  );
  const {data: eventStats, ...eventStatsResults} = useMetricEventStats(
    {project, rule, timePeriod, referrer},
    {
      enabled: !shouldUseSessionsStats,
      ...(options as Partial<UseApiQueryOptions<EventsStats>>),
    }
  );

  let stats: Series[] = [];

  if (shouldUseSessionsStats && sessionStats) {
    stats = transformSessionResponseToSeries(sessionStats, rule);
  } else if (eventStats) {
    stats = transformTimeseriesData(eventStats.data, eventStats?.meta, rule.aggregate);
  }

  let chartProps: Partial<AreaChartProps> = {};
  if (stats.length > 0) {
    const {chartOption} = getMetricAlertChartOption({
      timeseriesData: stats,
      rule,
      anomalies,
      incidents,
      seriesName: rule.aggregate,
    });
    chartProps = {...chartOption};
  }

  return {
    chartProps: {
      minutesThresholdToDisplaySeconds: shouldUseSessionsStats
        ? MINUTES_THRESHOLD_TO_DISPLAY_SECONDS
        : undefined,
      ...chartProps,
    },
    resultType: shouldUseSessionsStats ? 'sessions' : 'events',
    data: shouldUseSessionsStats ? sessionStats : eventStats,
    queryResult: shouldUseSessionsStats ? sessionStatsResults : eventStatsResults,
  };
}
