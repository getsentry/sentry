import {t} from 'sentry/locale';
import {useFetchSpanTimeSeries} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';
import {InsightsLineChartWidget} from 'sentry/views/insights/common/components/insightsLineChartWidget';
import type {LoadableChartWidgetProps} from 'sentry/views/insights/common/components/widgets/types';
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

  const {data, isPending, error} = useFetchSpanTimeSeries(
    {
      query: search,
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
      timeSeries={data?.timeSeries}
      queryInfo={{search, referrer}}
    />
  );
}
