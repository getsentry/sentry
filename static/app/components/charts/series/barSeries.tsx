import 'echarts/lib/chart/bar';

import {EChartOption} from 'echarts';

/**
 * TODO(ts): Bar chart can accept multiple values with an object, currently defined types are incorrect
 * See https://echarts.apache.org/en/option.html#series-bar.data
 */
type BarChartDataObject = Omit<EChartOption.SeriesBar.DataObject, 'value'> & {
  value: (string | number) | (string | number)[];
};

type Props = Omit<EChartOption.SeriesBar, 'data'> & {
  data?:
    | (string | number | void | BarChartDataObject | (string | number)[])[]
    | (string | number | void | BarChartDataObject)[][]
    | undefined;
};

function barSeries({data, ...rest}: Props): EChartOption.SeriesBar {
  return {
    ...rest,
    data: data as EChartOption.SeriesBar['data'],
    type: 'bar',
  };
}

export default barSeries;
