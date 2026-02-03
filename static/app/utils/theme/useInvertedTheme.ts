import {useTheme} from '@emotion/react';

import {darkTheme, lightTheme} from './theme';

export const useInvertedTheme = () => {
  const theme = useTheme();
  return theme.type === 'light' ? darkTheme : lightTheme;
};
