import 'echarts/lib/component/dataZoomInside';

import {EChartOption} from 'echarts';

const DEFAULT = {
  type: 'inside',
  // Mouse wheel can not trigger zoom
  zoomOnMouseWheel: false,
  // The translation (by mouse drag or touch drag) is avialable but zoom is not
  zoomLock: true,
  throttle: 50,
};

export default function DataZoomInside(
  props: EChartOption.DataZoom.Inside
): EChartOption.DataZoom[] {
  // `props` can be boolean, if so return default
  if (!props || !Array.isArray(props)) {
    const dataZoom = {
      ...DEFAULT,
      ...props,
    } as EChartOption.DataZoom.Inside;
    return [dataZoom];
  }

  return props;
}
