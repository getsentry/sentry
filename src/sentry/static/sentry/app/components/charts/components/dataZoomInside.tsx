import {EChartOption} from 'echarts';

const DEFAULT = {
  type: 'inside',
  zoomOnMouseWheel: 'shift',
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
