import 'echarts/lib/chart/line';

export default function LineSeries(props = {}) {
  return {
    showSymbol: false,
    ...props,
    type: 'line',
  };
}
