import {EChartOption} from 'echarts';
import 'echarts/lib/chart/bar';

export default function barSeries(
  props: EChartOption.SeriesBar = {}
): EChartOption.SeriesBar {
  return {
    ...props,
    type: 'bar',
  };
}
