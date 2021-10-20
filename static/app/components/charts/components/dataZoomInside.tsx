import 'echarts/lib/component/dataZoomInside';

import type {DataZoomComponentOption, InsideDataZoomComponentOption} from 'echarts';

const DEFAULT: InsideDataZoomComponentOption = {
  type: 'inside',
  // Mouse wheel can not trigger zoom
  zoomOnMouseWheel: false,
  // The translation (by mouse drag or touch drag) is avialable but zoom is not
  zoomLock: true,
  throttle: 50,
};

export default function DataZoomInside(
  props: InsideDataZoomComponentOption | InsideDataZoomComponentOption[]
): DataZoomComponentOption[] {
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
