import type {LoadableChartWidgetProps} from 'sentry/views/insights/common/components/widgets/types';
import {ThroughputChart} from 'sentry/views/insights/queues/charts/throughputChart';
import {Referrer} from 'sentry/views/insights/queues/referrers';

export default function QueuesLandingThroughputChartWidget(
  props: LoadableChartWidgetProps
) {
  return (
    <ThroughputChart
      {...props}
      id="queuesLandingThroughputChartWidget"
      referrer={Referrer.QUEUE_LANDING_THROUGHPUT_CHART}
    />
  );
}
