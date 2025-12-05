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
        normal: theme.tokens.content.success,
        border: theme.tokens.border.success,
      },
      needsImprovement: {
        light: theme.colors.yellow100,
        normal: theme.tokens.content.warning,
        border: theme.tokens.border.warning,
      },
      bad: {
        light: theme.colors.red100,
        normal: theme.tokens.content.danger,
        border: theme.tokens.border.danger,
      },
      none: {
        light: theme.colors.gray100,
        normal: theme.tokens.content.muted,
        border: theme.tokens.border.muted,
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
