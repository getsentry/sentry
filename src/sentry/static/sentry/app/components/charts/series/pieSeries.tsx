import {EChartOption} from 'echarts';

export default function PieSeries(
  props: EChartOption.SeriesPie = {}
): EChartOption.SeriesPie {
  return {
    radius: ['50%', '70%'],
    ...props,
    type: 'pie',
  };
}
