import 'echarts/lib/chart/map';
import 'echarts/lib/component/visualMap';
import 'echarts/map/js/world';

// import theme from 'app/utils/theme';

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
