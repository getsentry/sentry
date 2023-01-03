import {Theme} from '@emotion/react';
import type {YAXisComponentOption} from 'echarts';
import merge from 'lodash/merge';

type Props = YAXisComponentOption & {theme: Theme};

export default function YAxis({theme, ...props}: Props): YAXisComponentOption {
  return merge(
    {
      axisLine: {
        show: false,
      },
      axisTick: {
        show: false,
      },
      axisLabel: {
        color: theme.chartLabel,
        fontFamily: theme.text.family,
      },
      splitLine: {
        lineStyle: {
          color: theme.chartLineColor,
          opacity: 0.3,
        },
      },
    },
    props
  );
}
