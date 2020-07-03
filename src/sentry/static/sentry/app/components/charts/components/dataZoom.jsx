import 'echarts/lib/component/dataZoom';

const DEFAULT = {
  type: 'inside',
  zoomOnMouseWheel: 'shift',
  throttle: 50,
};

export default function DataZoom(props) {
  // `props` can be boolean, if so return default
  if (!props || !Array.isArray(props)) {
    return [{...DEFAULT, ...props}];
  }

  return props;
}
