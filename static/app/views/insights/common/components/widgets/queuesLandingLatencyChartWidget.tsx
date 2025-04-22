import type {LoadableChartWidgetProps} from 'sentry/views/insights/common/components/widgets/types';
import {LatencyChart} from 'sentry/views/insights/queues/charts/latencyChart';
import {Referrer} from 'sentry/views/insights/queues/referrers';

export default function QueuesLandingLatencyChartWidget(props: LoadableChartWidgetProps) {
  return (
    <LatencyChart
      {...props}
      id="queuesLandingLatencyChartWidget"
      referrer={Referrer.QUEUES_LANDING_CHARTS}
    />
  );
}
