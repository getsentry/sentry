import {EChartOption} from 'echarts';

/**
 * eCharts markArea
 *
 * See https://echarts.apache.org/en/option.html#series-line.markArea
 */
export default function MarkArea(
  props: EChartOption.SeriesLine['markArea']
): EChartOption.SeriesLine['markArea'] {
  return {
    ...props,
  };
}
