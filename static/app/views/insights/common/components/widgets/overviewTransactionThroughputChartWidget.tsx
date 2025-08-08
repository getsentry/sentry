import {t} from 'sentry/locale';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {InsightsLineChartWidget} from 'sentry/views/insights/common/components/insightsLineChartWidget';
import type {LoadableChartWidgetProps} from 'sentry/views/insights/common/components/widgets/types';
import {useSpanSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';
import {Referrer} from 'sentry/views/insights/pages/frontend/referrers';
import {useTransactionNameQuery} from 'sentry/views/insights/pages/platform/shared/useTransactionNameQuery';
import {SpanFields, type SpanProperty} from 'sentry/views/insights/types';

export default function OverviewTransactionThroughputChartWidget(
  props: LoadableChartWidgetProps
) {
  const {query} = useTransactionNameQuery();

  const title = t('Throughput');
  const search = new MutableSearch(`${SpanFields.IS_TRANSACTION}:true ${query}`);
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
