import 'echarts/lib/component/dataZoomSlider';

import type {SliderDataZoomComponentOption} from 'echarts';

const DEFAULT: SliderDataZoomComponentOption = {
  realtime: false,
  showDetail: false,
  left: 0,
  right: 6,
  bottom: 8,
};

export default function DataZoomSlider(
  props: SliderDataZoomComponentOption | SliderDataZoomComponentOption[]
): SliderDataZoomComponentOption[] {
  // `props` can be boolean, if so return default
  if (!props || !Array.isArray(props)) {
    const dataZoom = {
      ...DEFAULT,
      ...props,
    };
    return [dataZoom];
  }

  return props;
}
