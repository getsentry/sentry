import {useTheme} from '@emotion/react';

import MarkLine from 'sentry/components/charts/components/markLine';
import {t} from 'sentry/locale';

interface Props {
  value?: number;
}

export function AverageValueMarkLine({value}: Props = {}) {
  const theme = useTheme();

  return MarkLine({
    data: [
      // If a `value` is provided, set the markline to that value. If not, `type: 'average'` will automatically set it
      {
        valueDim: 'y',
        type: 'average',
        yAxis: value,
      },
    ],
    lineStyle: {
      color: theme.gray400,
    },
    emphasis: {disabled: true},
    label: {
      position: 'insideEndBottom',
      formatter: () => t(`Average`),
      fontSize: 14,
      color: theme.chartLabel,
      backgroundColor: theme.chartOther,
    },
  });
}
