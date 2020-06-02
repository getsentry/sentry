import 'echarts/lib/chart/map';
import 'echarts/map/js/world';

export default function MapSeries(props = {}) {
  return {
    roam: true,
    itemStyle: {
      emphasis: {label: {show: false}},
    },
    ...props,
    type: 'map',
  };
}
