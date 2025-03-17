import {t} from 'sentry/locale';
import type {EChartHighlightHandler, Series} from 'sentry/types/echarts';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import type {DataRow} from 'sentry/views/insights/cache/components/tables/spanSamplesTable';
import {Referrer} from 'sentry/views/insights/cache/referrers';
import {CHART_HEIGHT} from 'sentry/views/insights/cache/settings';
import {AVG_COLOR} from 'sentry/views/insights/colors';
import Chart, {ChartType} from 'sentry/views/insights/common/components/chart';
import ChartPanel from 'sentry/views/insights/common/components/chartPanel';
import {useMetricsSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';
import {AverageValueMarkLine} from 'sentry/views/insights/common/utils/averageValueMarkLine';
import {DataTitles} from 'sentry/views/insights/common/views/spans/types';
import {useSampleScatterPlotSeries} from 'sentry/views/insights/common/views/spanSummaryPage/sampleList/durationChart/useSampleScatterPlotSeries';
import type {MetricsQueryFilters} from 'sentry/views/insights/types';

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

  const {data, isPending} = useMetricsSeries(
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

    const highlightedDataPoints = event.batch.map((batch: any) => {
      const {seriesIndex, dataIndex} = batch;

      const highlightedSeries = allSeries?.[seriesIndex]!;
      const highlightedDataPoint = highlightedSeries.data?.[dataIndex];

      return {series: highlightedSeries, dataPoint: highlightedDataPoint};
    });

    onHighlight?.(highlightedDataPoints, event);
  };

  const baselineAvgSeries: Series = {
    seriesName: 'Average',
    data: [],
    markLine: AverageValueMarkLine({
      value: averageTransactionDuration,
    }),
  };

  return (
    <ChartPanel title={DataTitles['transaction.duration']}>
      <Chart
        height={CHART_HEIGHT}
        grid={{
          left: '0',
          right: '0',
          top: '8px',
          bottom: '0',
        }}
        scatterPlot={sampledSpanDataSeries}
        data={[
          {
            seriesName: t('Average Transaction Duration'),
            data: data['avg(transaction.duration)'].data,
          },
          baselineAvgSeries,
        ]}
        aggregateOutputFormat="duration"
        loading={isPending}
        onHighlight={handleChartHighlight}
        chartColors={[AVG_COLOR]}
        type={ChartType.LINE}
      />
    </ChartPanel>
  );
}
