import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import {Series} from 'sentry/types/echarts';
import {P95_COLOR} from 'sentry/views/starfish/colours';
import Chart from 'sentry/views/starfish/components/chart';
import {useSpanMetrics} from 'sentry/views/starfish/queries/useSpanMetrics';
import {useSpanMetricsSeries} from 'sentry/views/starfish/queries/useSpanMetricsSeries';
import {useSpanSamples} from 'sentry/views/starfish/queries/useSpanSamples';
import {SpanMetricsFields} from 'sentry/views/starfish/types';
import {DataTitles} from 'sentry/views/starfish/views/spans/types';

const {SPAN_SELF_TIME, SPAN_OP} = SpanMetricsFields;

type Props = {
  groupId: string;
  transactionName: string;
  spanDescription?: string;
};

function DurationChart({groupId, transactionName}: Props) {
  const theme = useTheme();

  const getSampleSymbol = (duration: number, p95: number) => {
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

  const {isLoading, data: spanMetricsSeriesData} = useSpanMetricsSeries(
    {group: groupId},
    {transactionName},
    [`p95(${SPAN_SELF_TIME})`],
    'sidebar-span-metrics'
  );

  const {data: spanMetrics} = useSpanMetrics(
    {group: groupId},
    {transactionName},
    [`p95(${SPAN_SELF_TIME})`, SPAN_OP],
    'span-summary-panel-samples-table-p95'
  );

  const p95 = spanMetrics?.[`p95(${SPAN_SELF_TIME})`] || 0;

  const {
    data: spans,
    isLoading: areSpanSamplesLoading,
    isRefetching: areSpanSamplesRefetching,
  } = useSpanSamples({
    groupId,
    transactionName,
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
    ({timestamp, 'span.self_time': duration, 'transaction.id': transaction_id}) => ({
      data: [
        {
          name: timestamp,
          value: duration,
        },
      ],
      symbol: getSampleSymbol(duration, p95).symbol,
      color: getSampleSymbol(duration, p95).color,
      symbolSize: 10,
      seriesName: transaction_id,
    })
  );

  return (
    <Fragment>
      <h5>{DataTitles.p95}</h5>
      <Chart
        statsPeriod="24h"
        height={140}
        data={[spanMetricsSeriesData?.[`p95(${SPAN_SELF_TIME})`], baselineP95Series]}
        start=""
        end=""
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
    </Fragment>
  );
}

export default DurationChart;
