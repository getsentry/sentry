import {EChartOption} from 'echarts';
import merge from 'lodash/merge';
/**
 * Drawing grid in rectangular coordinates
 *
 * e.g. alignment of your chart?
 */
export default function Grid(props: EChartOption.Grid = {}): EChartOption.Grid {
  return merge(
    {
      top: 20,
      bottom: 20,
      // This should allow for sufficient space for Y-axis labels
      left: '0%',
      right: '0%',
      containLabel: true,
    },
    props
  );
}
