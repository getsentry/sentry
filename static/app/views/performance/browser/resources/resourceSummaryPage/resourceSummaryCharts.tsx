import {AVG_COLOR} from 'sentry/views/starfish/colours';
import Chart from 'sentry/views/starfish/components/chart';
import ChartPanel from 'sentry/views/starfish/components/chartPanel';
import {useSpanMetricsSeries} from 'sentry/views/starfish/queries/useSpanMetricsSeries';
import {SpanMetricsField} from 'sentry/views/starfish/types';
import {getDurationChartTitle} from 'sentry/views/starfish/views/spans/types';
import {Block, BlockContainer} from 'sentry/views/starfish/views/spanSummaryPage/block';

function ResourceSummaryCharts(props: {groupId: string}) {
  const {data: spanMetricsSeriesData, isLoading: areSpanMetricsSeriesLoading} =
    useSpanMetricsSeries(props.groupId, {}, [
      `avg(${SpanMetricsField.SPAN_SELF_TIME})`,
      `avg(http.response_content_length)`,
    ]);

  return (
    <BlockContainer>
      <Block>
        <ChartPanel title={getDurationChartTitle('http')}>
          <Chart
            height={160}
            data={[spanMetricsSeriesData?.[`avg(${SpanMetricsField.SPAN_SELF_TIME})`]]}
            loading={areSpanMetricsSeriesLoading}
            utc={false}
            chartColors={[AVG_COLOR]}
            isLineChart
            definedAxisTicks={4}
          />
        </ChartPanel>
      </Block>
      <Block>
        <ChartPanel title="Resource Size">
          <Chart
            height={160}
            data={[spanMetricsSeriesData?.[`avg(${SpanMetricsField.SPAN_SELF_TIME})`]]}
            loading={areSpanMetricsSeriesLoading}
            utc={false}
            chartColors={[AVG_COLOR]}
            isLineChart
            definedAxisTicks={4}
          />
        </ChartPanel>
      </Block>
    </BlockContainer>
  );
}

export default ResourceSummaryCharts;
