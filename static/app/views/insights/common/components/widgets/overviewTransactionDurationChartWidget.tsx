import {t} from 'sentry/locale';
import {useFetchSpanTimeSeries} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';
import {InsightsLineChartWidget} from 'sentry/views/insights/common/components/insightsLineChartWidget';
import type {LoadableChartWidgetProps} from 'sentry/views/insights/common/components/widgets/types';
import {Referrer} from 'sentry/views/insights/pages/frontend/referrers';
import {useFrontendQuery} from 'sentry/views/insights/pages/frontend/useFrontendQuery';
import {SpanFields} from 'sentry/views/insights/types';

export default function OverviewTransactionDurationChartWidget(
  props: LoadableChartWidgetProps
) {
  const search = useFrontendQuery();
  const title = t('Duration');

  search.addFilterValue(SpanFields.IS_TRANSACTION, 'true');
  const referrer = Referrer.TRANSACTION_DURATION_CHART;

  const {data, isLoading, error} = useFetchSpanTimeSeries(
    {
      query: search,
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
      timeSeries={data?.timeSeries}
    />
  );
}
