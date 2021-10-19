import 'echarts/lib/chart/map';

import type {MapSeriesOption} from 'echarts';

export default function MapSeries(props: MapSeriesOption = {map: ''}): MapSeriesOption {
  return {
    roam: true,
    itemStyle: {
      // TODO(ts): label doesn't seem to exist on the emphasis? I have not
      //           verified if removing this has an affect on the world chart.
      emphasis: {label: {show: false}} as any,
    },
    ...props,
    type: 'map',
  } as MapSeriesOption;
}
