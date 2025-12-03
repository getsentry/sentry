import {useTheme} from '@emotion/react';

import {type Theme} from './theme';
import {DO_NOT_USE_darkChonkTheme, DO_NOT_USE_lightChonkTheme} from './theme.chonk';

export const useInvertedTheme = (): Theme => {
  const theme = useTheme();
  return theme.type === 'light'
    ? (DO_NOT_USE_darkChonkTheme as any)
    : (DO_NOT_USE_lightChonkTheme as any);
};
