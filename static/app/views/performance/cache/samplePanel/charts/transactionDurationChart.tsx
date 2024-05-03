import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import {Referrer} from 'sentry/views/performance/cache/referrers';
import {CHART_HEIGHT} from 'sentry/views/performance/cache/settings';
import {AVG_COLOR} from 'sentry/views/starfish/colors';
import Chart, {ChartType} from 'sentry/views/starfish/components/chart';
import ChartPanel from 'sentry/views/starfish/components/chartPanel';
import {useMetricsSeries} from 'sentry/views/starfish/queries/useSeries';
import type {MetricsQueryFilters} from 'sentry/views/starfish/types';
import {DataTitles} from 'sentry/views/starfish/views/spans/types';

export function TransactionDurationChart() {
  const {transaction} = useLocationQuery({
    fields: {
      project: decodeScalar,
      transaction: decodeScalar,
    },
  });

  const search: MetricsQueryFilters = {
    transaction,
  };

  const {data, isLoading} = useMetricsSeries({
    yAxis: ['avg(transaction.duration)'],
    search: MutableSearch.fromQueryObject(search),
    referrer: Referrer.SAMPLES_CACHE_TRANSACTION_DURATION,
  });

  return (
    <ChartPanel title={DataTitles.transactionDuration}>
      <Chart
        height={CHART_HEIGHT}
        grid={{
          left: '0',
          right: '0',
          top: '8px',
          bottom: '0',
        }}
        data={[data['avg(transaction.duration)']]}
        loading={isLoading}
        chartColors={[AVG_COLOR]}
        type={ChartType.LINE}
      />
    </ChartPanel>
  );
}
