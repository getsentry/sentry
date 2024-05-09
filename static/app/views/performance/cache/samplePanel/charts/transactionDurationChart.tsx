import type {EChartHighlightHandler} from 'sentry/types/echarts';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import {Referrer} from 'sentry/views/performance/cache/referrers';
import {CHART_HEIGHT} from 'sentry/views/performance/cache/settings';
import type {DataRow} from 'sentry/views/performance/cache/tables/spanSamplesTable';
import {AVG_COLOR} from 'sentry/views/starfish/colors';
import Chart, {ChartType} from 'sentry/views/starfish/components/chart';
import ChartPanel from 'sentry/views/starfish/components/chartPanel';
import {useMetricsSeries} from 'sentry/views/starfish/queries/useDiscoverSeries';
import type {MetricsQueryFilters} from 'sentry/views/starfish/types';
import {DataTitles} from 'sentry/views/starfish/views/spans/types';
import {useSampleScatterPlotSeries} from 'sentry/views/starfish/views/spanSummaryPage/sampleList/durationChart/useSampleScatterPlotSeries';

type Props = {
  averageTransactionDuration: number;
  onHighlight: EChartHighlightHandler;
  samples: DataRow[];
  highlightedSpanId?: string;
};

export function TransactionDurationChart({
  samples,
  averageTransactionDuration,
  onHighlight,
  highlightedSpanId,
}: Props) {
  const {transaction} = useLocationQuery({
    fields: {
      project: decodeScalar,
      transaction: decodeScalar,
    },
  });

  const search: MetricsQueryFilters = {
    transaction,
  };

  const {data, isLoading} = useMetricsSeries(
    {
      yAxis: ['avg(transaction.duration)'],
      search: MutableSearch.fromQueryObject(search),
    },
    Referrer.SAMPLES_CACHE_TRANSACTION_DURATION_CHART
  );

  const sampledSpanDataSeries = useSampleScatterPlotSeries(
    samples,
    averageTransactionDuration,
    highlightedSpanId,
    'transaction.duration'
  );

  // TODO: This is duplicated from `DurationChart` in `SampleList`. Resolve the duplication
  const handleChartHighlight: EChartHighlightHandler = function (event) {
    // TODO: Gross hack. Even though `scatterPlot` is a separate prop, it's just an array of `Series` that gets appended to the main series. To find the point that was hovered, we re-construct the correct series order. It would have been cleaner to just pass the scatter plot as its own, single series
    const allSeries = [
      data['avg(transaction.duration)'],
      ...(sampledSpanDataSeries ?? []),
    ];

    const highlightedDataPoints = event.batch.map(batch => {
      const {seriesIndex, dataIndex} = batch;

      const highlightedSeries = allSeries?.[seriesIndex];
      const highlightedDataPoint = highlightedSeries.data?.[dataIndex];

      return {series: highlightedSeries, dataPoint: highlightedDataPoint};
    });

    onHighlight?.(highlightedDataPoints, event);
  };

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
        scatterPlot={sampledSpanDataSeries}
        data={[data['avg(transaction.duration)']]}
        loading={isLoading}
        onHighlight={handleChartHighlight}
        chartColors={[AVG_COLOR]}
        type={ChartType.LINE}
      />
    </ChartPanel>
  );
}
