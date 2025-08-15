import {decodeScalar} from 'sentry/utils/queryString';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import type {LoadableChartWidgetProps} from 'sentry/views/insights/common/components/widgets/types';
import {ThroughputChart} from 'sentry/views/insights/queues/charts/throughputChart';
import {Referrer} from 'sentry/views/insights/queues/referrers';

export default function QueuesSummaryThroughputChartWidget(
  props: LoadableChartWidgetProps
) {
  const {destination} = useLocationQuery({
    fields: {
      destination: decodeScalar,
    },
  });

  return (
    <ThroughputChart
      {...props}
      id="queuesSummaryThroughputChartWidget"
      referrer={Referrer.QUEUES_SUMMARY_THROUGHPUT_CHART}
      destination={destination}
    />
  );
}
