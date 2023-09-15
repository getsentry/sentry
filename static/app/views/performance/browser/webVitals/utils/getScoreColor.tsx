import {Theme} from '@emotion/react';

export const getScoreColor = (score: number, theme: Theme) => {
  return score >= 90 ? theme.green300 : score >= 50 ? theme.yellow300 : theme.red300;
};
