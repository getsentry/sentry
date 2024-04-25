import {t} from 'sentry/locale';
import type {Series} from 'sentry/types/echarts';
import EventView, {type MetaType} from 'sentry/utils/discover/eventView';
import {RateUnit} from 'sentry/utils/discover/fields';
import {
  type DiscoverQueryProps,
  useGenericDiscoverQuery,
} from 'sentry/utils/discover/genericDiscoverQuery';
import {formatRate} from 'sentry/utils/formatters';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {
  AVG_COLOR,
  THROUGHPUT_COLOR,
  TXN_THROUGHPUT_COLOR,
} from 'sentry/views/starfish/colours';
import Chart, {ChartType} from 'sentry/views/starfish/components/chart';
import ChartPanel from 'sentry/views/starfish/components/chartPanel';
import {useSpanMetricsSeries} from 'sentry/views/starfish/queries/useSpanMetricsSeries';
import {
  SpanMetricsField,
  type SpanMetricsQueryFilters,
} from 'sentry/views/starfish/types';
import {Block, BlockContainer} from 'sentry/views/starfish/views/spanSummaryPage/block';

function SpanSummaryCharts() {
  const organization = useOrganization();
  const {spanSlug} = useParams();
  const [spanOp, groupId] = spanSlug.split(':');

  const location = useLocation();
  const {transaction} = location.query;

  const filters: SpanMetricsQueryFilters = {
    'span.group': groupId,
    'span.op': spanOp,
    transaction: transaction as string,
  };

  const {
    isLoading: isThroughputDataLoading,
    data: throughputData,
    error: throughputError,
  } = useSpanMetricsSeries({
    search: MutableSearch.fromQueryObject(filters),
    yAxis: ['spm()'],
    enabled: Boolean(groupId),
    referrer: 'api.starfish.span-summary-page-charts',
  });

  const {
    isLoading: isAvgDurationDataLoading,
    data: avgDurationData,
    error: avgDurationError,
  } = useSpanMetricsSeries({
    search: MutableSearch.fromQueryObject(filters),
    yAxis: [`avg(${SpanMetricsField.SPAN_SELF_TIME})`],
    enabled: Boolean(groupId),
    referrer: 'api.starfish.span-summary-page-charts',
  });

  const eventView = EventView.fromNewQueryWithLocation(
    {
      yAxis: ['count()'],
      name: 'Transaction Throughput',
      query: MutableSearch.fromQueryObject({
        transaction: transaction as string,
      }).formatString(),
      fields: [],
      version: 2,
    },
    location
  );

  const {
    isLoading: isTxnThroughputDataLoading,
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
      topEvents: eventView.topEvents,
      excludeOther: 0,
      partial: 1,
      orderby: undefined,
      interval: eventView.interval,
    }),
    options: {
      refetchOnWindowFocus: false,
    },
    referrer: 'api.starfish.span-summary-page-charts',
  });

  const transactionSeries: Series = {
    seriesName: 'Throughput',
    data:
      txnThroughputData?.data.map(datum => ({
        value: datum[1][0].count,
        name: datum[0],
      })) ?? [],
  };

  return (
    <BlockContainer>
      <Block>
        <ChartPanel title={t('Average Duration')}>
          <Chart
            height={160}
            data={[avgDurationData?.[`avg(${SpanMetricsField.SPAN_SELF_TIME})`]]}
            loading={isAvgDurationDataLoading}
            type={ChartType.LINE}
            definedAxisTicks={4}
            aggregateOutputFormat="duration"
            stacked
            error={avgDurationError}
            chartColors={[AVG_COLOR]}
            // tooltipFormatterOptions={{
            //   valueFormatter: value => formatDuration({duration: value, DurationUnit.MINUTE}),
            // }}
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
            stacked
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
            stacked
            error={txnThroughputError}
            chartColors={[TXN_THROUGHPUT_COLOR]}
            tooltipFormatterOptions={{
              valueFormatter: value => formatRate(value, RateUnit.PER_MINUTE),
            }}
          />
        </ChartPanel>
      </Block>

      {/* //
        // <Block>
        // <ChartPanel title={getDurationChartTitle('http')}>
        // <Chart
        //       height={160}
        //       data={[spanMetricsSeriesData?.[`avg(${SPAN_SELF_TIME})`]]}
        //       loading={areSpanMetricsSeriesLoading}
        //       chartColors={[AVG_COLOR]}
        //       type={ChartType.LINE}
        //       definedAxisTicks={4}
        // />
        // </ChartPanel>
        // </Block>
        // <Block>
        // <ChartPanel title={t('Average Resource Size')}>
        // <Chart
        //       height={160}
        //       aggregateOutputFormat="size"
        //       data={[
        //         spanMetricsSeriesData?.[`avg(${HTTP_DECODED_RESPONSE_CONTENT_LENGTH})`],
        //         spanMetricsSeriesData?.[`avg(${HTTP_RESPONSE_TRANSFER_SIZE})`],
        //         spanMetricsSeriesData?.[`avg(${HTTP_RESPONSE_CONTENT_LENGTH})`],
        //       ]}
        //       loading={areSpanMetricsSeriesLoading}
        //       chartColors={[AVG_COLOR]}
        //       type={ChartType.LINE}
        //       definedAxisTicks={4}
        //       tooltipFormatterOptions={{
        //         valueFormatter: bytes =>
        //           getDynamicText({
        //             value: formatBytesBase2(bytes),
        //             fixed: 'xx KiB',
        //           }),
        //         nameFormatter: name => DataTitles[name],
        //       }}
        // />
        // </ChartPanel>
        // </Block> */}
    </BlockContainer>
  );
}

/**
 * Ensures a series has no zeros between two non-zero datapoints. This is useful in
 * @param series the series to fill
 * @returns a reference to the initial series filled
 */
export const fillSeries = (series: Series): Series => {
  if (!series.data.length) {
    return series;
  }

  let lastSeenValue = series.data[0].value;

  return {
    ...series,
    data: series.data.map(dataPoint => {
      const value = dataPoint.value;
      if (value !== lastSeenValue && value !== 0) {
        lastSeenValue = value;
        return {...dataPoint};
      }
      return {...dataPoint, value: lastSeenValue};
    }),
  };
};

export default SpanSummaryCharts;
