import {EChartOption} from 'echarts';
import 'echarts/lib/component/graphic';

/**
 * eCharts graphic
 *
 * See https://echarts.apache.org/en/option.html#graphic
 */
export default function Graphic(props: EChartOption['graphic']): EChartOption['graphic'] {
  return props;
}
