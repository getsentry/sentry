import {useTheme} from '@emotion/react';

import MarkLine from 'sentry/components/charts/components/markLine';
import {t} from 'sentry/locale';

interface Props {
  label?: string;
  value?: number;
}

export function BaselineMarkLine({value, label}: Props = {}) {
  const theme = useTheme();

  return MarkLine({
    data: [
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
      formatter: () => label ?? t('Baseline'),
      fontSize: 14,
      color: theme.chartLabel,
      backgroundColor: theme.chartOther,
    },
  });
}
