import 'echarts/lib/component/graphic';
import {EChartOption} from 'echarts';

/**
 * eCharts graphic
 *
 * See https://echarts.apache.org/en/option.html#graphic
 */
export default function Graphic(props: EChartOption['graphic']): EChartOption['graphic'] {
  return props;
}
