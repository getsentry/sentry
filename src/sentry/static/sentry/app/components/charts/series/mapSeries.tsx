import 'echarts/lib/chart/map';
import {EChartOption} from 'echarts';

export default function MapSeries(
  props: EChartOption.SeriesMap = {}
): EChartOption.SeriesMap {
  return {
    roam: true,
    itemStyle: {
      // TODO(ts): label doesn't seem to exist on the emphasis? I have not
      //           verified if removing this has an affect on the world chart.
      emphasis: {label: {show: false}} as any,
    },
    ...props,
    type: 'map',
  };
}
