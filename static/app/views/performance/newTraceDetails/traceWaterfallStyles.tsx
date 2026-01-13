import type {Theme} from '@emotion/react';

export const traceGridCssVariables = ({theme}: {theme: Theme}) => `
  --info: ${theme.tokens.graphics.accent.vibrant};
  --warning: ${theme.tokens.graphics.warning.vibrant};
  --debug: ${theme.tokens.graphics.accent.vibrant};
  --error: ${theme.tokens.graphics.danger.vibrant};
  --fatal: ${theme.tokens.graphics.danger.vibrant};
  --default: ${theme.tokens.graphics.neutral.vibrant};
  --unknown: ${theme.tokens.graphics.neutral.vibrant};
  --profile: ${theme.tokens.graphics.accent.vibrant};
  --autogrouped: ${theme.tokens.graphics.accent.vibrant};
  --occurence: ${theme.tokens.graphics.accent.vibrant};
`;
