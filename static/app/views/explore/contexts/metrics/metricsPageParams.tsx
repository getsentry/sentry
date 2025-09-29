import {LogsAnalyticsPageSource} from 'sentry/utils/analytics/logsAnalyticsEvent';
import {createDefinedContext} from 'sentry/utils/context';

export const METRICS_QUERY_KEY = 'metricsQuery';
export const METRICS_SORT_BYS_KEY = 'metricsSortBys';
export const METRICS_FIELDS_KEY = 'metricsFields';
export const METRICS_GROUP_BY_KEY = 'metricsGroupBy';
export const METRICS_AGGREGATE_FN_KEY = 'metricsAggregateFn';
export const METRICS_AGGREGATE_PARAM_KEY = 'metricsAggregateParam';
export const METRICS_VISUALIZES_KEY = 'metricsVisualizes';
export const METRICS_METRIC_NAME_KEY = 'metricName';
export const METRICS_METRIC_TYPE_KEY = 'metricType';

export interface MetricsPageParams {
  analyticsPageSource: LogsAnalyticsPageSource;
}

const [_MetricsPageParamsProvider, _useMetricsPageParams, _ctx] =
  createDefinedContext<MetricsPageParams>({
    name: 'MetricsPageParamsContext',
  });

export const MetricsPageParamsProvider = _MetricsPageParamsProvider;
export const useMetricsPageParams = _useMetricsPageParams;
