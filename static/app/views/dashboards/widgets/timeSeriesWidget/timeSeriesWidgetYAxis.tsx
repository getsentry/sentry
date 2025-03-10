import type {YAXisComponentOption} from 'echarts';
import merge from 'lodash/merge';

type TimeSeriesWidgetYAxisProps = YAXisComponentOption;

export function TimeSeriesWidgetYAxis(
  props: TimeSeriesWidgetYAxisProps
): YAXisComponentOption {
  return merge(
    {
      type: 'value',
      animation: false,
      axisPointer: {
        type: 'line' as const,
        snap: false,
        lineStyle: {
          type: 'solid',
          width: 0.5,
        },
        label: {
          show: false,
        },
      },
    },
    props
  );
}
