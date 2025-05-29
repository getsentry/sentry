import {decodeScalar} from 'sentry/utils/queryString';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import type {LoadableChartWidgetProps} from 'sentry/views/insights/common/components/widgets/types';
import {LatencyChart} from 'sentry/views/insights/queues/charts/latencyChart';
import {Referrer} from 'sentry/views/insights/queues/referrers';

export default function QueuesSummaryLatencyChartWidget(props: LoadableChartWidgetProps) {
  const {destination} = useLocationQuery({
    fields: {
      destination: decodeScalar,
    },
  });

  return (
    <LatencyChart
      {...props}
      id="queuesSummaryLatencyChartWidget"
      referrer={Referrer.QUEUES_SUMMARY_LATENCY_CHART}
      destination={destination}
    />
  );
}
