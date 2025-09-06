import {t} from 'sentry/locale';
import {InsightsLineChartWidget} from 'sentry/views/insights/common/components/insightsLineChartWidget';
import type {LoadableChartWidgetProps} from 'sentry/views/insights/common/components/widgets/types';
import {useSpanSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';
import {Referrer} from 'sentry/views/insights/pages/frontend/referrers';
import {useFrontendQuery} from 'sentry/views/insights/pages/frontend/useFrontendQuery';
import {SpanFields, type SpanProperty} from 'sentry/views/insights/types';

export default function OverviewTransactionThroughputChartWidget(
  props: LoadableChartWidgetProps
) {
  const search = useFrontendQuery();
  const title = t('Throughput');

  search.addFilterValue(SpanFields.IS_TRANSACTION, 'true');
  const yAxis: SpanProperty = 'epm()';
  const referrer = Referrer.TRANSACTION_THROUGHPUT_CHART;

  const {data, isPending, error} = useSpanSeries(
    {
      search,
      yAxis: [yAxis],
    },
    referrer
  );

  return (
    <InsightsLineChartWidget
      {...props}
      id="overviewTransactionThroughputChartWidget"
      title={title}
      height="100%"
      error={error}
      isLoading={isPending}
      series={[data[yAxis]]}
      queryInfo={{search, referrer}}
    />
  );
}
