import 'echarts/lib/chart/map';

import type {MapSeriesOption} from 'echarts';

export default function MapSeries(props: MapSeriesOption = {map: ''}): MapSeriesOption {
  return {
    roam: true,
    ...props,
    emphasis: {
      label: {show: false},
      ...props.emphasis,
    },
    type: 'map',
  };
}
