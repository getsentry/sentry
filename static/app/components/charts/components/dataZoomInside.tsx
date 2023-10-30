import 'echarts/lib/component/dataZoomInside';

import type {InsideDataZoomComponentOption} from 'echarts';

const DEFAULT: InsideDataZoomComponentOption = {
  type: 'inside',
  // Mouse wheel can not trigger zoom
  zoomOnMouseWheel: false,
  // The translation (by mouse drag or touch drag) is available but zoom is not
  zoomLock: true,
  throttle: 50,
};

export default function DataZoomInside(
  props: InsideDataZoomComponentOption | InsideDataZoomComponentOption[]
): InsideDataZoomComponentOption[] {
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
