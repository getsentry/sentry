import type {Theme} from '@emotion/react';

export const traceGridCssVariables = ({theme}: {theme: Theme}) => `
  --info: ${theme.purple400};
  --warning: ${theme.yellow300};
  --debug: ${theme.blue300};
  --error: ${theme.tokens.graphics.danger};
  --fatal: ${theme.tokens.graphics.danger};
  --default: ${theme.colors.gray400};
  --unknown: ${theme.colors.gray400};
  --profile: ${theme.purple300};
  --autogrouped: ${theme.blue300};
  --occurence: ${theme.blue300};
`;
