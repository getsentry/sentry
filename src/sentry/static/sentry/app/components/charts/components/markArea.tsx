import {EChartOption} from 'echarts';
import 'echarts/lib/component/markArea';

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
