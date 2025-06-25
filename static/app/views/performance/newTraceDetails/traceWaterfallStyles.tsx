import type {Theme} from '@emotion/react';

export const traceGridCssVariables = ({theme}: {theme: Theme}) => `
  --info: ${theme.purple400};
  --warning: ${theme.yellow300};
  --debug: ${theme.blue300};
  --error: ${theme.error};
  --fatal: ${theme.error};
  --default: ${theme.gray300};
  --unknown: ${theme.gray300};
  --profile: ${theme.purple300};
  --autogrouped: ${theme.blue300};
  --occurence: ${theme.blue300};
`;
