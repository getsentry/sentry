import {HTTPMetricsWidget} from 'sentry/views/insights/common/components/httpMetricsWidget';
import {Referrer} from 'sentry/views/insights/http/referrers';

export function HTTPResponseCodesWidget() {
  return <HTTPMetricsWidget metricType="response-codes" referrer={Referrer.LANDING_RESPONSE_CODE_CHART} />;
}
