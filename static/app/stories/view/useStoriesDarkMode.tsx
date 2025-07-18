import type {PropsWithChildren} from 'react';
import {ThemeProvider, useTheme} from '@emotion/react';

import {darkTheme, type Theme} from './theme';
import {DO_NOT_USE_darkChonkTheme} from './theme.chonk';

/**
 * Access the raw values from the dark theme
 *
 * ⚠️ DO NOT USE OUTSIDE OF STORIES
 */
export const useStoryDarkModeTheme = (): Theme => {
  const theme = useTheme();
  if (theme.isChonk) {
    return DO_NOT_USE_darkChonkTheme as any;
  }
  return darkTheme;
};

/**
 * Forces all `children` to be rendered in dark mode,
 * regardless of user preferences.
 *
 * ⚠️ DO NOT USE OUTSIDE OF STORIES
 */
export function StoryDarkModeProvider(props: PropsWithChildren) {
  const theme = useStoryDarkModeTheme();
  return <ThemeProvider theme={theme}>{props.children}</ThemeProvider>;
}
