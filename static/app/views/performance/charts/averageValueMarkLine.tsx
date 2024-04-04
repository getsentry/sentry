import {useTheme} from '@emotion/react';

import MarkLine from 'sentry/components/charts/components/markLine';

interface Props {
  value: number;
}

export function AverageValueMarkLine({value}: Props) {
  const theme = useTheme();

  if (!value) return undefined;

  return MarkLine({
    data: [
      {
        valueDim: 'x',
        yAxis: value,
      },
    ],
    symbol: ['none', 'none'],
    lineStyle: {
      color: theme.gray400,
    },
    emphasis: {disabled: true},
    label: {
      position: 'insideEndBottom',
      formatter: () => `Average`,
      fontSize: 14,
      color: theme.chartLabel,
      backgroundColor: theme.chartOther,
    },
  });
}
