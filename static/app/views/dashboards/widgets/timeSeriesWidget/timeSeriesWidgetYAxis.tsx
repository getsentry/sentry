import type {YAXisComponentOption} from 'echarts';
import merge from 'lodash/merge';

import {Y_AXIS_INTEGER_TOLERANCE} from './settings';

type TimeSeriesWidgetYAxisProps = YAXisComponentOption;

export function TimeSeriesWidgetYAxis(
  props: TimeSeriesWidgetYAxisProps,
  yAxisFieldType: string,
  yAxisRange: 'auto' | 'dataMin'
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
      min: yAxisRange === 'auto' ? null : 'dataMin',
      // @ts-expect-error ECharts types are wrong here. Returning `undefined` from the `max` function is 100% allowed and is listed in the documentation. See https://github.com/apache/echarts/pull/12215/
      max: value => {
        // Handle a very specific edge case with percentage formatting.
        // Percentage charts values usually range from 0 to 1, but JavaScript
        // floating math is such that the maximum value at any point in the
        // chart might be something like 1.0000000002. This is not enough to
        // be visible or significant, but _is_ enough for ECharts to add a
        // whole additional axis tick. This makes charts looks stupid, because
        // the Y axis will be from 0% to 120%, instead of from 0% to 100%. To
        // prevent this case, if the maximum value is _just slightly above 1_,
        // force it to be exactly 1. Only for percentages!
        if (
          yAxisFieldType === 'percentage' &&
          value.max > 1 &&
          value.max - 1 < Y_AXIS_INTEGER_TOLERANCE
        ) {
          return 1;
        }

        // We show at most 2 decimal places for percentages (e.g. 0.01%).
        // If the maximum value is _just slightly above 0_, force it to be
        // exactly 0.01% to avoid showing only 0% on the Y axis.
        if (yAxisFieldType === 'percentage' && value.max < 0.001) {
          return 0.001;
        }

        // "Score" axes are _always_ from 0 to 100. Otherwise it's unclear how much
        // opportunity there is to improve them.
        if (yAxisFieldType === 'score') {
          return 100;
        }

        return null;
      },
    },
    props
  );
}
