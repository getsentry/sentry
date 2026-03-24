import 'echarts/lib/component/markArea';

import type {MarkAreaComponentOption} from 'echarts';

/**
 * eCharts markArea
 *
 * See https://echarts.apache.org/en/option.html#series-line.markArea
 */
export function MarkArea(props: MarkAreaComponentOption): MarkAreaComponentOption {
  return {
    ...props,
  };
}
