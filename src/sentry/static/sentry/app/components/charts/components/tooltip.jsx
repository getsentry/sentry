import 'echarts/lib/component/tooltip';

export default function Tooltip(props = {}) {
  return {
    show: true,
    trigger: 'axis',
    ...props,
  };
}
