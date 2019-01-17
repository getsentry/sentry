import 'echarts/lib/component/markLine';

/**
 * eCharts markLine
 *
 * See https://ecomfe.github.io/echarts-doc/public/en/option.html#series-line.markLine
 */
export default function MarkLine(props) {
  return {
    // The second symbol is a very ugly arrow, we don't want it
    symbol: ['circle', 'none'],

    // Default size is super big imo
    symbolSize: 6,
    ...props,
  };
}
