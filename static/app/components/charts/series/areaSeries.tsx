import {EChartOption} from 'echarts';

import LineSeries from 'app/components/charts/series/lineSeries';

export default function AreaSeries(
  props: EChartOption.SeriesLine = {}
): EChartOption.SeriesLine {
  return LineSeries({
    ...props,
  });
}
