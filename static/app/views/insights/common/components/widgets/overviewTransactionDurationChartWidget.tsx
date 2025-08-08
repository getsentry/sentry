import {t} from 'sentry/locale';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {InsightsLineChartWidget} from 'sentry/views/insights/common/components/insightsLineChartWidget';
import type {LoadableChartWidgetProps} from 'sentry/views/insights/common/components/widgets/types';
import {useSpanSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';
import {Referrer} from 'sentry/views/insights/pages/frontend/referrers';
import {useTransactionNameQuery} from 'sentry/views/insights/pages/platform/shared/useTransactionNameQuery';
import {SpanFields} from 'sentry/views/insights/types';

export default function OverviewTransactionDurationChartWidget(
  props: LoadableChartWidgetProps
) {
  const {query} = useTransactionNameQuery();

  const title = t('Duration');
  const search = new MutableSearch(`${SpanFields.IS_TRANSACTION}:true ${query}`);
  const referrer = Referrer.TRANSACTION_DURATION_CHART;

  const {data, isLoading, error} = useSpanSeries(
    {
      search,
      yAxis: ['p50(span.duration)', 'p75(span.duration)', 'p95(span.duration)'],
    },
    referrer
  );

  return (
    <InsightsLineChartWidget
      {...props}
      id="overviewTransactionDurationChartWidget"
      queryInfo={{search, referrer}}
      title={title}
      height="100%"
      error={error}
      isLoading={isLoading}
      series={[
        data['p50(span.duration)'],
        data['p75(span.duration)'],
        data['p95(span.duration)'],
      ]}
    />
  );
}
