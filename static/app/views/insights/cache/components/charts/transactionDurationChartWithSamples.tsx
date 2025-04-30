import {t} from 'sentry/locale';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import type {Samples} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/samples';
import {Referrer} from 'sentry/views/insights/cache/referrers';
import {InsightsLineChartWidget} from 'sentry/views/insights/common/components/insightsLineChartWidget';
import type {DiscoverSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';
import {
  useEAPSeries,
  useMetricsSeries,
} from 'sentry/views/insights/common/queries/useDiscoverSeries';
import {useInsightsEap} from 'sentry/views/insights/common/utils/useEap';
import {
  MetricsFields,
  type MetricsQueryFilters,
  SpanFields,
  type SpanQueryFilters,
} from 'sentry/views/insights/types';

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

  const {data, isPending, error} = useTransactionDurationSeries({transaction});

  return (
    <InsightsLineChartWidget
      showLegend="never"
      title={t('Average Transaction Duration')}
      isLoading={isPending}
      error={error}
      series={[data['avg(span.duration)']]}
      samples={samples}
    />
  );
}

export const useTransactionDurationSeries = ({transaction}: {transaction: string}) => {
  const useEap = useInsightsEap();

  const metricsResult = useMetricsSeries(
    {
      yAxis: [`avg(${MetricsFields.TRANSACTION_DURATION})`],
      search: MutableSearch.fromQueryObject({
        transaction,
      } satisfies MetricsQueryFilters),
      transformAliasToInputFormat: true,
    },
    Referrer.SAMPLES_CACHE_TRANSACTION_DURATION_CHART
  );

  const eapResult = useEAPSeries(
    {
      search: MutableSearch.fromQueryObject({
        transaction,
        is_transaction: 'true',
      } satisfies SpanQueryFilters),
      yAxis: [`avg(${SpanFields.SPAN_DURATION})`],
    },
    Referrer.SAMPLES_CACHE_TRANSACTION_DURATION
  );

  const result = useEap ? eapResult : metricsResult;
  const finalData: {['avg(span.duration)']: DiscoverSeries} = useEap
    ? eapResult.data
    : {
        [`avg(${SpanFields.SPAN_DURATION})`]:
          metricsResult.data['avg(transaction.duration)'],
      };

  return {...result, data: finalData};
};
