import 'echarts/lib/component/dataZoomInside';

import {DataZoomComponentOption, InsideDataZoomComponentOption} from 'echarts';

const DEFAULT = {
  type: 'inside',
  // Mouse wheel can not trigger zoom
  zoomOnMouseWheel: false,
  // The translation (by mouse drag or touch drag) is avialable but zoom is not
  zoomLock: true,
  throttle: 50,
};

export default function DataZoomInside(
  props: InsideDataZoomComponentOption
): DataZoomComponentOption[] {
  // `props` can be boolean, if so return default
  if (!props || !Array.isArray(props)) {
    const dataZoom = {
      ...DEFAULT,
      ...props,
    } as InsideDataZoomComponentOption;
    return [dataZoom];
  }

  return props;
}
