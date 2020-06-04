import 'echarts/lib/component/markLine';

/**
 * eCharts markLine
 *
 * See https://echarts.apache.org/en/option.html#series-line.markLine
 */
export default function MarkLine(props) {
  return {
    // The second symbol is a very ugly arrow, we don't want it
    symbol: ['none', 'none'],
    ...props,
  };
}
