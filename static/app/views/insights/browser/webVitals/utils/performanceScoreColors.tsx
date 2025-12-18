import type {Theme} from '@emotion/react';

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
};
