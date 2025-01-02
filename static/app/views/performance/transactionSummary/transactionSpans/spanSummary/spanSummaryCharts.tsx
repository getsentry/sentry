import {t} from 'sentry/locale';
import type {Series} from 'sentry/types/echarts';
import EventView, {type MetaType} from 'sentry/utils/discover/eventView';
import {RateUnit} from 'sentry/utils/discover/fields';
import {
  type DiscoverQueryProps,
  useGenericDiscoverQuery,
} from 'sentry/utils/discover/genericDiscoverQuery';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {formatRate} from 'sentry/utils/formatters';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {
  AVG_COLOR,
  THROUGHPUT_COLOR,
  TXN_THROUGHPUT_COLOR,
} from 'sentry/views/insights/colors';
import Chart, {ChartType} from 'sentry/views/insights/common/components/chart';
import ChartPanel from 'sentry/views/insights/common/components/chartPanel';
import {useSpanMetricsSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';
import {
  Block,
  BlockContainer,
} from 'sentry/views/insights/common/views/spanSummaryPage/block';
import {
  SpanMetricsField,
  type SpanMetricsQueryFilters,
} from 'sentry/views/insights/types';
import {SpanSummaryReferrer} from 'sentry/views/performance/transactionSummary/transactionSpans/spanSummary/referrers';

function SpanSummaryCharts() {
  const organization = useOrganization();
  const {spanSlug} = useParams();
  const [spanOp, groupId] = spanSlug!.split(':');

  const location = useLocation();
  const {transaction} = location.query;

  const filters: SpanMetricsQueryFilters = {
    'span.group': groupId,
    'span.op': spanOp,
    transaction: transaction as string,
  };

  const {
    isPending: isThroughputDataLoading,
    data: throughputData,
    error: throughputError,
  } = useSpanMetricsSeries(
    {
      search: MutableSearch.fromQueryObject(filters),
      yAxis: ['spm()'],
    },
    SpanSummaryReferrer.SPAN_SUMMARY_THROUGHPUT_CHART
  );

  const {
    isPending: isAvgDurationDataLoading,
    data: avgDurationData,
    error: avgDurationError,
  } = useSpanMetricsSeries(
    {
      search: MutableSearch.fromQueryObject(filters),
      yAxis: [`avg(${SpanMetricsField.SPAN_DURATION})`],
    },
    SpanSummaryReferrer.SPAN_SUMMARY_DURATION_CHART
  );

  const eventView = EventView.fromNewQueryWithLocation(
    {
      yAxis: ['tpm()'],
      name: 'Transaction Throughput',
      query: MutableSearch.fromQueryObject({
        transaction: transaction as string,
      }).formatString(),
      fields: [],
      version: 2,
      dataset: DiscoverDatasets.METRICS,
    },
    location
  );

  const {
    isPending: isTxnThroughputDataLoading,
    data: txnThroughputData,
    error: txnThroughputError,
  } = useGenericDiscoverQuery<
    {
      data: any[];
      meta: MetaType;
    },
    DiscoverQueryProps
  >({
    route: 'events-stats',
    eventView,
    location,
    orgSlug: organization.slug,
    getRequestPayload: () => ({
      ...eventView.getEventsAPIPayload(location),
      yAxis: eventView.yAxis,
      interval: eventView.interval,
    }),
    options: {
      refetchOnWindowFocus: false,
    },
    referrer: SpanSummaryReferrer.SPAN_SUMMARY_TRANSACTION_THROUGHPUT_CHART,
  });

  const transactionSeries: Series = {
    seriesName: 'tpm()',
    data:
      txnThroughputData?.data.map(datum => ({
        value: datum[1][0].count,
        name: datum[0] * 1000,
      })) ?? [],
  };

  return (
    <BlockContainer>
      <Block>
        <ChartPanel title={t('Average Duration')}>
          <Chart
            height={160}
            data={[avgDurationData?.[`avg(${SpanMetricsField.SPAN_DURATION})`]]}
            loading={isAvgDurationDataLoading}
            type={ChartType.LINE}
            definedAxisTicks={4}
            aggregateOutputFormat="duration"
            error={avgDurationError}
            chartColors={[AVG_COLOR]}
          />
        </ChartPanel>
      </Block>

      <Block>
        <ChartPanel title={t('Span Throughput')}>
          <Chart
            height={160}
            data={[throughputData?.[`spm()`]]}
            loading={isThroughputDataLoading}
            type={ChartType.LINE}
            definedAxisTicks={4}
            aggregateOutputFormat="rate"
            rateUnit={RateUnit.PER_MINUTE}
            error={throughputError}
            chartColors={[THROUGHPUT_COLOR]}
            tooltipFormatterOptions={{
              valueFormatter: value => formatRate(value, RateUnit.PER_MINUTE),
            }}
          />
        </ChartPanel>
      </Block>

      <Block>
        <ChartPanel title={t('Transaction Throughput')}>
          <Chart
            height={160}
            data={[transactionSeries]}
            loading={isTxnThroughputDataLoading}
            type={ChartType.LINE}
            definedAxisTicks={4}
            aggregateOutputFormat="rate"
            rateUnit={RateUnit.PER_MINUTE}
            error={txnThroughputError}
            chartColors={[TXN_THROUGHPUT_COLOR]}
            tooltipFormatterOptions={{
              valueFormatter: value => formatRate(value, RateUnit.PER_MINUTE),
            }}
          />
        </ChartPanel>
      </Block>
    </BlockContainer>
  );
}

export default SpanSummaryCharts;
