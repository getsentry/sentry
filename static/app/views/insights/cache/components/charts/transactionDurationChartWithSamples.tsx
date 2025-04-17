import {t} from 'sentry/locale';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import type {Samples} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/samples';
import {Referrer} from 'sentry/views/insights/cache/referrers';
import {InsightsLineChartWidget} from 'sentry/views/insights/common/components/insightsLineChartWidget';
import {useMetricsSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';
import type {MetricsQueryFilters} from 'sentry/views/insights/types';

type Props = {
  samples: Samples;
};

export function TransactionDurationChartWithSamples({samples}: Props) {
  const {transaction} = useLocationQuery({
    fields: {
      project: decodeScalar,
      transaction: decodeScalar,
    },
  });

  const search: MetricsQueryFilters = {
    transaction,
  };

  const {data, isPending, error} = useMetricsSeries(
    {
      yAxis: ['avg(transaction.duration)'],
      search: MutableSearch.fromQueryObject(search),
      transformAliasToInputFormat: true,
    },
    Referrer.SAMPLES_CACHE_TRANSACTION_DURATION_CHART
  );

  return (
    <InsightsLineChartWidget
      showLegend="never"
      title={t('Average Transaction Duration')}
      isLoading={isPending}
      error={error}
      series={[data['avg(transaction.duration)']]}
      samples={samples}
    />
  );
}
