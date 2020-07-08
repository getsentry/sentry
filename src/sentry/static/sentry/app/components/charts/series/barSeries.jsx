import 'echarts/lib/chart/bar';

export default function barSeries(props = {}) {
  return {
    type: 'bar',
    ...props,
  };
}
