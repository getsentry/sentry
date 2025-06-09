import {t} from 'sentry/locale';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import type {Samples} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/samples';
import {Referrer} from 'sentry/views/insights/cache/referrers';
// TODO(release-drawer): Only used in cache/components/samplePanel
// eslint-disable-next-line no-restricted-imports
import {InsightsLineChartWidget} from 'sentry/views/insights/common/components/insightsLineChartWidget';
import type {DiscoverSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';
import {
  useEAPSeries,
  useMetricsSeries,
} from 'sentry/views/insights/common/queries/useDiscoverSeries';
import {useInsightsEap} from 'sentry/views/insights/common/utils/useEap';
import type {SearchHook, SpanQueryFilters} from 'sentry/views/insights/types';
import {MetricsFields, SpanFields} from 'sentry/views/insights/types';

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

  const {search} = useTransactionDurationSearch({transaction});
  const referrer = Referrer.SAMPLES_CACHE_TRANSACTION_DURATION_CHART;

  const {data, isPending, error} = useTransactionDurationSeries({search});

  return (
    <InsightsLineChartWidget
      queryInfo={{search, referrer}}
      showLegend="never"
      title={t('Average Transaction Duration')}
      isLoading={isPending}
      error={error}
      series={[data['avg(span.duration)']]}
      samples={samples}
    />
  );
}

const useTransactionDurationSearch = ({
  transaction,
}: {
  transaction: string;
}): SearchHook => {
  const useEap = useInsightsEap();
  const search = useEap
    ? MutableSearch.fromQueryObject({
        transaction,
        is_transaction: 'true',
      } satisfies SpanQueryFilters)
    : MutableSearch.fromQueryObject({transaction} satisfies SpanQueryFilters);

  return {search};
};

const useTransactionDurationSeries = ({search}: {search: MutableSearch}) => {
  const useEap = useInsightsEap();

  const metricsResult = useMetricsSeries(
    {
      yAxis: [`avg(${MetricsFields.TRANSACTION_DURATION})`],
      search,
      transformAliasToInputFormat: true,
      enabled: !useEap,
    },
    Referrer.SAMPLES_CACHE_TRANSACTION_DURATION_CHART
  );

  const eapResult = useEAPSeries(
    {
      search,
      yAxis: [`avg(${SpanFields.SPAN_DURATION})`],
      enabled: useEap,
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
