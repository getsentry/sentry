import {EChartOption} from 'echarts';
import 'echarts/lib/chart/pie';

export default function PieSeries(
  props: EChartOption.SeriesPie = {}
): EChartOption.SeriesPie {
  return {
    radius: ['50%', '70%'],
    ...props,
    type: 'pie',
  };
}
