import 'echarts/lib/chart/pie';

export default function PieSeries(props = {}) {
  return {
    radius: ['50%', '70%'],
    ...props,
    type: 'pie',
  };
}
