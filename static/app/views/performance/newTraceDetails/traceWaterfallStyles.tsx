import type {Theme} from '@emotion/react';

import {isChonkTheme} from 'sentry/utils/theme/withChonk';

export const traceGridCssVariables = ({theme}: {theme: Theme}) => `
  --info: ${theme.purple400};
  --warning: ${theme.yellow300};
  --debug: ${theme.blue300};
  --error: ${isChonkTheme(theme) ? theme.tokens.graphics.danger : theme.error};
  --fatal: ${isChonkTheme(theme) ? theme.tokens.graphics.danger : theme.error};
  --default: ${theme.gray300};
  --unknown: ${theme.gray300};
  --profile: ${theme.purple300};
  --autogrouped: ${theme.blue300};
  --occurence: ${theme.blue300};
`;
