import {t} from 'sentry/locale';
import {Series} from 'sentry/types/echarts';
import {formatBytesBase2} from 'sentry/utils';
import {formatRate} from 'sentry/utils/formatters';
import getDynamicText from 'sentry/utils/getDynamicText';
import {RESOURCE_THROUGHPUT_UNIT} from 'sentry/views/performance/browser/resources';
import {useResourceModuleFilters} from 'sentry/views/performance/browser/resources/utils/useResourceFilters';
import {AVG_COLOR, THROUGHPUT_COLOR} from 'sentry/views/starfish/colours';
import Chart from 'sentry/views/starfish/components/chart';
import ChartPanel from 'sentry/views/starfish/components/chartPanel';
import {useSpanMetricsSeries} from 'sentry/views/starfish/queries/useSpanMetricsSeries';
import {SpanMetricsField} from 'sentry/views/starfish/types';
import {
  DataTitles,
  getDurationChartTitle,
  getThroughputChartTitle,
} from 'sentry/views/starfish/views/spans/types';
import {Block, BlockContainer} from 'sentry/views/starfish/views/spanSummaryPage/block';

const {
  SPAN_SELF_TIME,
  HTTP_RESPONSE_CONTENT_LENGTH,
  HTTP_DECODED_RESPONSE_CONTENT_LENGTH,
  HTTP_RESPONSE_TRANSFER_SIZE,
  RESOURCE_RENDER_BLOCKING_STATUS,
} = SpanMetricsField;

function ResourceSummaryCharts(props: {groupId: string}) {
  const filters = useResourceModuleFilters();
  // console.log({
  //   ...(filters[RESOURCE_RENDER_BLOCKING_STATUS]
  //     ? {[RESOURCE_RENDER_BLOCKING_STATUS]: filters[RESOURCE_RENDER_BLOCKING_STATUS]}
  //     : {}),
  // });

  const {data: spanMetricsSeriesData, isLoading: areSpanMetricsSeriesLoading} =
    useSpanMetricsSeries(
      {
        'span.group': props.groupId,
        ...(filters[RESOURCE_RENDER_BLOCKING_STATUS]
          ? {[RESOURCE_RENDER_BLOCKING_STATUS]: filters[RESOURCE_RENDER_BLOCKING_STATUS]}
          : {}),
      },
      [
        `spm()`,
        `avg(${SPAN_SELF_TIME})`,
        `avg(${HTTP_RESPONSE_CONTENT_LENGTH})`,
        `avg(${HTTP_DECODED_RESPONSE_CONTENT_LENGTH})`,
        `avg(${HTTP_RESPONSE_TRANSFER_SIZE})`,
      ]
    );

  if (spanMetricsSeriesData) {
    spanMetricsSeriesData[`avg(${HTTP_RESPONSE_TRANSFER_SIZE})`].lineStyle = {
      type: 'dashed',
    };
    spanMetricsSeriesData[`avg(${HTTP_DECODED_RESPONSE_CONTENT_LENGTH})`].lineStyle = {
      type: 'dashed',
    };
  }

  return (
    <BlockContainer>
      <Block>
        <ChartPanel title={getThroughputChartTitle('http', RESOURCE_THROUGHPUT_UNIT)}>
          <Chart
            height={160}
            data={[spanMetricsSeriesData?.[`spm()`]]}
            loading={areSpanMetricsSeriesLoading}
            isLineChart
            definedAxisTicks={4}
            aggregateOutputFormat="rate"
            rateUnit={RESOURCE_THROUGHPUT_UNIT}
            stacked
            chartColors={[THROUGHPUT_COLOR]}
            tooltipFormatterOptions={{
              valueFormatter: value => formatRate(value, RESOURCE_THROUGHPUT_UNIT),
              nameFormatter: () => t('Requests'),
            }}
          />
        </ChartPanel>
      </Block>
      <Block>
        <ChartPanel title={getDurationChartTitle('http')}>
          <Chart
            height={160}
            data={[spanMetricsSeriesData?.[`avg(${SPAN_SELF_TIME})`]]}
            loading={areSpanMetricsSeriesLoading}
            chartColors={[AVG_COLOR]}
            isLineChart
            definedAxisTicks={4}
          />
        </ChartPanel>
      </Block>
      <Block>
        <ChartPanel title={t('Average Resource Size')}>
          <Chart
            height={160}
            aggregateOutputFormat="size"
            data={[
              spanMetricsSeriesData?.[`avg(${HTTP_DECODED_RESPONSE_CONTENT_LENGTH})`],
              spanMetricsSeriesData?.[`avg(${HTTP_RESPONSE_TRANSFER_SIZE})`],
              spanMetricsSeriesData?.[`avg(${HTTP_RESPONSE_CONTENT_LENGTH})`],
            ]}
            loading={areSpanMetricsSeriesLoading}
            chartColors={[AVG_COLOR]}
            isLineChart
            definedAxisTicks={4}
            tooltipFormatterOptions={{
              valueFormatter: bytes =>
                getDynamicText({
                  value: formatBytesBase2(bytes),
                  fixed: 'xx KiB',
                }),
              nameFormatter: name => DataTitles[name],
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
