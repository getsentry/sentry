import 'echarts/lib/chart/bar';

import {BarSeriesOption} from 'echarts';

/**
 * TODO(ts): Bar chart can accept multiple values with an object, currently defined types are incorrect
 * See https://echarts.apache.org/en/option.html#series-bar.data
 */
type BarChartDataObject = Omit<BarSeriesOption['data'], 'value'> & {
  value: (string | number) | (string | number)[];
};

type Props = Omit<BarSeriesOption, 'data'> & {
  data?:
    | (string | number | void | BarChartDataObject | (string | number)[])[]
    | (string | number | void | BarChartDataObject)[][]
    | undefined;
};

function barSeries({data, ...rest}: Props): BarSeriesOption {
  return {
    ...rest,
    data: data as BarSeriesOption['data'],
    type: 'bar',
  };
}

export default barSeries;
