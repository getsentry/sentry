import type {Theme} from '@emotion/react';

import {isChonkTheme} from 'sentry/utils/theme/withChonk';

export type PerformanceScore = 'good' | 'needsImprovement' | 'bad' | 'none';

type PerformanceScoreColors = Record<
  PerformanceScore,
  {
    border: string;
    light: string;
    normal: string;
  }
>;

export const makePerformanceScoreColors = (theme: Theme): PerformanceScoreColors => {
  if (isChonkTheme(theme)) {
    return {
      good: {
        light: theme.colors.gray100,
        normal: theme.colors.content.success,
        border: theme.colors.border.success,
      },
      needsImprovement: {
        light: theme.colors.yellow100,
        normal: theme.colors.content.warning,
        border: theme.colors.border.warning,
      },
      bad: {
        light: theme.colors.red100,
        normal: theme.colors.content.danger,
        border: theme.colors.border.danger,
      },
      none: {
        light: theme.colors.gray100,
        normal: theme.colors.content.muted,
        border: theme.colors.border.muted,
      },
    };
  }
  return {
    good: {
      light: theme.green100,
      normal: theme.green300,
      border: theme.green200,
    },
    needsImprovement: {
      light: theme.yellow100,
      normal: theme.yellow400,
      border: theme.yellow200,
    },
    bad: {
      light: theme.red100,
      normal: theme.red300,
      border: theme.red200,
    },
    none: {
      light: theme.gray100,
      normal: theme.gray300,
      border: theme.gray200,
    },
  };
};
