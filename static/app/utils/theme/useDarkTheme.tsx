import type {PropsWithChildren} from 'react';
import {ThemeProvider, useTheme} from '@emotion/react';

import {darkTheme, type Theme} from './theme';
import {DO_NOT_USE_darkChonkTheme} from './theme.chonk';

/**
 * Access the raw values from the dark theme
 *
 * ⚠️ Use the generic `useTheme` hook unless you have a very specific use case!
 */
export const useDarkTheme = (): Theme => {
  const theme = useTheme();
  if (theme.isChonk) {
    return DO_NOT_USE_darkChonkTheme as any;
  }
  return darkTheme;
};

/**
 * Forces all `children` to be rendered in dark mode,
 * regardless of user preferences.
 */
export function DarkThemeProvider(props: PropsWithChildren) {
  const theme = useDarkTheme();
  return <ThemeProvider theme={theme}>{props.children}</ThemeProvider>;
}
