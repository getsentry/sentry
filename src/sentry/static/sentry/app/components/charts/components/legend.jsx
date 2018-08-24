import 'echarts/lib/component/legend';

export default function Legend(props = {}) {
  return {
    show: true,
    ...props,
  };
}
