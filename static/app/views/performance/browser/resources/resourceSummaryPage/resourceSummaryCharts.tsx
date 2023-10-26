import {t} from 'sentry/locale';
import {Series} from 'sentry/types/echarts';
import {formatBytesBase2} from 'sentry/utils';
import getDynamicText from 'sentry/utils/getDynamicText';
import roundFileSize from 'sentry/views/performance/browser/resources/utils/roundFileSize';
import {AVG_COLOR} from 'sentry/views/starfish/colours';
import Chart from 'sentry/views/starfish/components/chart';
import ChartPanel from 'sentry/views/starfish/components/chartPanel';
import {useSpanMetricsSeries} from 'sentry/views/starfish/queries/useSpanMetricsSeries';
import {SpanMetricsField} from 'sentry/views/starfish/types';
import {getDurationChartTitle} from 'sentry/views/starfish/views/spans/types';
import {Block, BlockContainer} from 'sentry/views/starfish/views/spanSummaryPage/block';

const {SPAN_SELF_TIME, HTTP_RESPONSE_CONTENT_LENGTH} = SpanMetricsField;

function ResourceSummaryCharts(props: {groupId: string}) {
  const {data: spanMetricsSeriesData, isLoading: areSpanMetricsSeriesLoading} =
    useSpanMetricsSeries(props.groupId, {}, [
      `avg(${SPAN_SELF_TIME})`,
      `avg(${HTTP_RESPONSE_CONTENT_LENGTH})`,
    ]);

  return (
    <BlockContainer>
      <Block>
        <ChartPanel title={getDurationChartTitle('http')}>
          <Chart
            height={160}
            data={[spanMetricsSeriesData?.[`avg(${SPAN_SELF_TIME})`]]}
            loading={areSpanMetricsSeriesLoading}
            utc={false}
            chartColors={[AVG_COLOR]}
            isLineChart
            definedAxisTicks={4}
          />
        </ChartPanel>
      </Block>
      <Block>
        <ChartPanel title={t('Resource Size')}>
          <Chart
            height={160}
            data={[spanMetricsSeriesData?.[`avg(${HTTP_RESPONSE_CONTENT_LENGTH})`]]}
            loading={areSpanMetricsSeriesLoading}
            utc={false}
            chartColors={[AVG_COLOR]}
            isLineChart
            definedAxisTicks={4}
            tooltipFormatterOptions={{
              valueFormatter: bytes =>
                getDynamicText({
                  value: formatBytesBase2(roundFileSize(bytes)),
                  fixed: 'xx KB',
                }),
            }}
          />
        </ChartPanel>
      </Block>
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

export default ResourceSummaryCharts;
