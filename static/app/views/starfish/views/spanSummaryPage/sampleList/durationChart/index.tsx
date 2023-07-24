import {useTheme} from '@emotion/react';

import {t} from 'sentry/locale';
import {EChartClickHandler, EChartHighlightHandler, Series} from 'sentry/types/echarts';
import {usePageError} from 'sentry/utils/performance/contexts/pageError';
import {P95_COLOR} from 'sentry/views/starfish/colours';
import Chart from 'sentry/views/starfish/components/chart';
import {isNearBaseline} from 'sentry/views/starfish/components/samplesTable/common';
import {useSpanMetrics} from 'sentry/views/starfish/queries/useSpanMetrics';
import {useSpanMetricsSeries} from 'sentry/views/starfish/queries/useSpanMetricsSeries';
import {SpanSample, useSpanSamples} from 'sentry/views/starfish/queries/useSpanSamples';
import {SpanMetricsFields} from 'sentry/views/starfish/types';
import {DataTitles} from 'sentry/views/starfish/views/spans/types';

const {SPAN_SELF_TIME, SPAN_OP} = SpanMetricsFields;

type Props = {
  groupId: string;
  transactionMethod: string;
  transactionName: string;
  highlightedSpanId?: string;
  onClickSample?: (sample: SpanSample) => void;
  onMouseLeaveSample?: () => void;
  onMouseOverSample?: (sample: SpanSample) => void;
  spanDescription?: string;
};

function DurationChart({
  groupId,
  transactionName,
  onClickSample,
  onMouseLeaveSample,
  onMouseOverSample,
  highlightedSpanId,
  transactionMethod,
}: Props) {
  const theme = useTheme();
  const {setPageError} = usePageError();

  const getSampleSymbol = (
    duration: number,
    p95: number
  ): {color: string; symbol: string} => {
    if (isNearBaseline(duration, p95)) {
      return {
        symbol: 'path://M 0 0 V -8 L 5 0 L 0 8 L -5 0 L 0 -8',
        color: theme.gray300,
      };
    }

    return duration > p95
      ? {
          symbol: 'path://M 5 4 L 0 -4 L -5 4 L 5 4',
          color: theme.red300,
        }
      : {
          symbol: 'path://M -5 -4 L 0 4 L 5 -4 L -5 -4',
          color: theme.green300,
        };
  };

  const {
    isLoading,
    data: spanMetricsSeriesData,
    error: spanMetricsSeriesError,
  } = useSpanMetricsSeries(
    {group: groupId},
    {transactionName, 'transaction.method': transactionMethod},
    [`p95(${SPAN_SELF_TIME})`],
    'api.starfish.sidebar-span-metrics-chart'
  );

  const {data: spanMetrics, error: spanMetricsError} = useSpanMetrics(
    {group: groupId},
    {transactionName, 'transaction.method': transactionMethod},
    [`p95(${SPAN_SELF_TIME})`, SPAN_OP],
    'api.starfish.span-summary-panel-samples-table-p95'
  );

  const p95 = spanMetrics?.[`p95(${SPAN_SELF_TIME})`] || 0;

  const {
    data: spans,
    isLoading: areSpanSamplesLoading,
    isRefetching: areSpanSamplesRefetching,
  } = useSpanSamples({
    groupId,
    transactionName,
    transactionMethod,
  });

  const baselineP95Series: Series = {
    seriesName: 'Baseline P95',
    data: [],
    markLine: {
      data: [{valueDim: 'x', yAxis: p95}],
      symbol: ['none', 'none'],
      lineStyle: {
        color: theme.gray400,
      },
      emphasis: {disabled: true},
      label: {
        fontSize: 11,
        position: 'insideEndBottom',
        formatter: () => 'Baseline P95',
      },
    },
  };

  const sampledSpanDataSeries: Series[] = spans.map(
    ({
      timestamp,
      [SPAN_SELF_TIME]: duration,
      'transaction.id': transaction_id,
      span_id,
    }) => ({
      data: [
        {
          name: timestamp,
          value: duration,
        },
      ],
      symbol: getSampleSymbol(duration, p95).symbol,
      color: getSampleSymbol(duration, p95).color,
      symbolSize: span_id === highlightedSpanId ? 15 : 10,
      seriesName: transaction_id.substring(0, 8),
    })
  );

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
    setPageError(t('An error has occured while loading chart data'));
  }

  return (
    <div onMouseLeave={handleMouseLeave}>
      <h5>{DataTitles.p95}</h5>
      <Chart
        height={140}
        onClick={handleChartClick}
        onHighlight={handleChartHighlight}
        aggregateOutputFormat="duration"
        data={[spanMetricsSeriesData?.[`p95(${SPAN_SELF_TIME})`], baselineP95Series]}
        loading={isLoading}
        scatterPlot={
          areSpanSamplesLoading || areSpanSamplesRefetching
            ? undefined
            : sampledSpanDataSeries
        }
        utc={false}
        chartColors={[P95_COLOR, 'black']}
        isLineChart
        definedAxisTicks={4}
      />
    </div>
  );
}

export default DurationChart;
