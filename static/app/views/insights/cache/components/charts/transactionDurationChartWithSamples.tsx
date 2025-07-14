import {t} from 'sentry/locale';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import type {Samples} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/samples';
import {Referrer} from 'sentry/views/insights/cache/referrers';
// TODO(release-drawer): Only used in cache/components/samplePanel
// eslint-disable-next-line no-restricted-imports
import {InsightsLineChartWidget} from 'sentry/views/insights/common/components/insightsLineChartWidget';
import {useEAPSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';
import type {SpanQueryFilters} from 'sentry/views/insights/types';
import {SpanFields} from 'sentry/views/insights/types';

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

  const search = MutableSearch.fromQueryObject({
    transaction,
    is_transaction: 'true',
  } satisfies SpanQueryFilters);
  const referrer = Referrer.SAMPLES_CACHE_TRANSACTION_DURATION_CHART;

  const {data, isPending, error} = useEAPSeries(
    {
      search,
      yAxis: [`avg(${SpanFields.SPAN_DURATION})`],
    },
    Referrer.SAMPLES_CACHE_TRANSACTION_DURATION
  );

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
