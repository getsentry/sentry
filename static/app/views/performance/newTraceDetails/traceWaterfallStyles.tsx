import type {Theme} from '@emotion/react';

export const traceGridCssVariables = ({theme}: {theme: Theme}) => `
  --info: ${theme.colors.blue500};
  --warning: ${theme.colors.yellow400};
  --debug: ${theme.colors.blue400};
  --error: ${theme.tokens.graphics.danger};
  --fatal: ${theme.tokens.graphics.danger};
  --default: ${theme.colors.gray400};
  --unknown: ${theme.colors.gray400};
  --profile: ${theme.colors.blue400};
  --autogrouped: ${theme.colors.blue400};
  --occurence: ${theme.colors.blue400};
`;
