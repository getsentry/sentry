import type {Theme} from '@emotion/react';
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
        color: theme.tokens.content.muted,
        fontFamily: theme.text.family,
      },
      splitLine: {
        lineStyle: {
          color: theme.colors.gray300,
          opacity: 0.3,
        },
      },
    },
    props
  );
}
