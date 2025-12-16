import type {Theme} from '@emotion/react';

export const traceGridCssVariables = ({theme}: {theme: Theme}) => `
  --info: ${theme.purple400};
  --warning: ${theme.yellow300};
  --debug: ${theme.colors.blue400};
  --error: ${theme.tokens.graphics.danger};
  --fatal: ${theme.tokens.graphics.danger};
  --default: ${theme.gray300};
  --unknown: ${theme.gray300};
  --profile: ${theme.purple300};
  --autogrouped: ${theme.colors.blue400};
  --occurence: ${theme.colors.blue400};
`;
