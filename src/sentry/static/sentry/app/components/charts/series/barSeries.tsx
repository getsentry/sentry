import {EChartOption} from 'echarts';
import 'echarts/lib/chart/bar';

/**
 * TODO(ts): Bar chart can accept multiple values with an object, currently defined types are incorrect
 * See https://echarts.apache.org/en/option.html#series-bar.data
 */
type BarChartDataObject = Omit<EChartOption.SeriesBar.DataObject, 'value'> & {
  value: (string | number) | (string | number)[];
};

export default function barSeries(
  props: Omit<EChartOption.SeriesBar, 'data'> & {
    data?:
      | (string | number | void | BarChartDataObject | (string | number)[])[]
      | (string | number | void | BarChartDataObject)[][]
      | undefined;
  } = {}
): EChartOption.SeriesBar {
  const {data, ...rest} = props;
  return {
    ...rest,
    data: data as EChartOption.SeriesBar['data'],
    type: 'bar',
  };
}
