import {t} from 'sentry/locale';
import type {
  EChartClickHandler,
  EChartHighlightHandler,
  Series,
} from 'sentry/types/echarts';
import {usePageAlert} from 'sentry/utils/performance/contexts/pageAlert';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import usePageFilters from 'sentry/utils/usePageFilters';
import {AverageValueMarkLine} from 'sentry/views/performance/charts/averageValueMarkLine';
import {AVG_COLOR} from 'sentry/views/starfish/colors';
import Chart, {ChartType} from 'sentry/views/starfish/components/chart';
import ChartPanel from 'sentry/views/starfish/components/chartPanel';
import {useSpanMetricsSeries} from 'sentry/views/starfish/queries/useSeries';
import {useSpanMetrics} from 'sentry/views/starfish/queries/useSpanMetrics';
import type {SpanSample} from 'sentry/views/starfish/queries/useSpanSamples';
import {useSpanSamples} from 'sentry/views/starfish/queries/useSpanSamples';
import type {SpanMetricsQueryFilters} from 'sentry/views/starfish/types';
import {SpanMetricsField} from 'sentry/views/starfish/types';
import {useSampleScatterPlotSeries} from 'sentry/views/starfish/views/spanSummaryPage/sampleList/durationChart/useSampleScatterPlotSeries';

const {SPAN_SELF_TIME, SPAN_OP} = SpanMetricsField;

type Props = {
  groupId: string;
  transactionName: string;
  additionalFields?: string[];
  additionalFilters?: Record<string, string>;
  highlightedSpanId?: string;
  onClickSample?: (sample: SpanSample) => void;
  onMouseLeaveSample?: () => void;
  onMouseOverSample?: (sample: SpanSample) => void;
  platform?: string;
  query?: string[];
  release?: string;
  spanDescription?: string;
  transactionMethod?: string;
};

function DurationChart({
  groupId,
  transactionName,
  onClickSample,
  onMouseLeaveSample,
  onMouseOverSample,
  highlightedSpanId,
  transactionMethod,
  additionalFields,
  release,
  query,
  platform,
  additionalFilters,
}: Props) {
  const {setPageError} = usePageAlert();
  const pageFilter = usePageFilters();

  const filters: SpanMetricsQueryFilters = {
    'span.group': groupId,
    transaction: transactionName,
  };

  if (transactionMethod) {
    filters['transaction.method'] = transactionMethod;
  }

  if (release) {
    filters.release = release;
  }

  if (platform) {
    filters['os.name'] = platform;
  }

  const {
    isLoading,
    data: spanMetricsSeriesData,
    error: spanMetricsSeriesError,
  } = useSpanMetricsSeries({
    search: MutableSearch.fromQueryObject({...filters, ...additionalFilters}),
    yAxis: [`avg(${SPAN_SELF_TIME})`],
    enabled: Object.values({...filters, ...additionalFilters}).every(value =>
      Boolean(value)
    ),
    referrer: 'api.starfish.sidebar-span-metrics-chart',
  });

  const {data, error: spanMetricsError} = useSpanMetrics({
    search: MutableSearch.fromQueryObject(filters),
    fields: [`avg(${SPAN_SELF_TIME})`, SPAN_OP],
    enabled: Object.values(filters).every(value => Boolean(value)),
    referrer: 'api.starfish.span-summary-panel-samples-table-avg',
  });

  const spanMetrics = data[0] ?? {};

  const avg = spanMetrics?.[`avg(${SPAN_SELF_TIME})`] || 0;

  const {
    data: spans,
    isLoading: areSpanSamplesLoading,
    isRefetching: areSpanSamplesRefetching,
  } = useSpanSamples({
    groupId,
    transactionName,
    transactionMethod,
    release,
    query,
    additionalFields,
  });

  const baselineAvgSeries: Series = {
    seriesName: 'Average',
    data: [],
    markLine: AverageValueMarkLine({
      value: avg,
    }),
  };

  const sampledSpanDataSeries = useSampleScatterPlotSeries(spans, avg, highlightedSpanId);

  const getSample = (timestamp: string, duration: number) => {
    return spans.find(s => s.timestamp === timestamp && s[SPAN_SELF_TIME] === duration);
  };

  const handleChartClick: EChartClickHandler = e => {
    const isSpanSample = e?.componentSubType === 'scatter';
    if (isSpanSample && onClickSample) {
      const [timestamp, duration] = e.value as [string, number];
      const sample = getSample(timestamp, duration);
      if (sample) {
        onClickSample(sample);
      }
    }
  };

  const handleChartHighlight: EChartHighlightHandler = e => {
    const {seriesIndex} = e.batch[0];
    const isSpanSample = seriesIndex > 1;
    if (isSpanSample && onMouseOverSample) {
      const spanSampleData = sampledSpanDataSeries?.[seriesIndex - 2]?.data[0];
      const {name: timestamp, value: duration} = spanSampleData;
      const sample = getSample(timestamp as string, duration);
      if (sample) {
        onMouseOverSample(sample);
      }
    }
    if (!isSpanSample && onMouseLeaveSample) {
      onMouseLeaveSample();
    }
  };

  const handleMouseLeave = () => {
    if (onMouseLeaveSample) {
      onMouseLeaveSample();
    }
  };

  if (spanMetricsSeriesError || spanMetricsError) {
    setPageError(t('An error has occurred while loading chart data'));
  }

  const subtitle = pageFilter.selection.datetime.period
    ? t('Last %s', pageFilter.selection.datetime.period)
    : t('Last period');

  return (
    <ChartPanel title={t('Average Duration')} subtitle={subtitle}>
      <div onMouseLeave={handleMouseLeave}>
        <Chart
          height={140}
          onClick={handleChartClick}
          onHighlight={handleChartHighlight}
          aggregateOutputFormat="duration"
          data={[spanMetricsSeriesData?.[`avg(${SPAN_SELF_TIME})`], baselineAvgSeries]}
          loading={isLoading}
          scatterPlot={
            areSpanSamplesLoading || areSpanSamplesRefetching
              ? undefined
              : sampledSpanDataSeries
          }
          chartColors={[AVG_COLOR, 'black']}
          type={ChartType.LINE}
          definedAxisTicks={4}
        />
      </div>
    </ChartPanel>
  );
}

export default DurationChart;
