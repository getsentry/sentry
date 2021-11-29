import 'echarts/lib/component/markPoint';

import type {MarkPointComponentOption} from 'echarts';

/**
 * eCharts markPoint
 *
 * See https://ecomfe.github.io/echarts-doc/public/en/option.html#series-line.markPoint
 */
export default function MarkPoint(
  props: MarkPointComponentOption
): MarkPointComponentOption {
  return {
    ...props,
  };
}
