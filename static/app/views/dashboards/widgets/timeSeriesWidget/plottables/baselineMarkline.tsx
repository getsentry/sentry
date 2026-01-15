import MarkLine from 'sentry/components/charts/components/markLine';
import {t} from 'sentry/locale';
import type {Theme} from 'sentry/utils/theme';

interface Props {
  theme: Theme;
  value: number;
  label?: string;
}

export function BaselineMarkLine({theme, value, label}: Props) {
  return MarkLine({
    data: [
      {
        valueDim: 'y',
        type: 'average',
        yAxis: value,
      },
    ],
    lineStyle: {
      color: theme.colors.gray500,
    },
    emphasis: {disabled: true},
    label: {
      position: 'insideEndBottom',
      formatter: () => label ?? t('Baseline'),
      fontSize: 14,
      color: theme.tokens.content.secondary,
      backgroundColor: theme.tokens.background.primary,
    },
  });
}
