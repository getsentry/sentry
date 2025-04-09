import {HTTPMetricsWidget} from 'sentry/views/insights/common/components/httpMetricsWidget';
import {Referrer} from 'sentry/views/insights/http/referrers';

export function HTTPThroughputWidget() {
  return <HTTPMetricsWidget metricType="throughput" referrer={Referrer.LANDING_THROUGHPUT_CHART} />;
}
