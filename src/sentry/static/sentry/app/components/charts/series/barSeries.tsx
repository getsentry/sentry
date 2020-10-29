import {EChartOption} from 'echarts';

export default function barSeries(
  props: EChartOption.SeriesBar = {}
): EChartOption.SeriesBar {
  return {
    ...props,
    type: 'bar',
  };
}
