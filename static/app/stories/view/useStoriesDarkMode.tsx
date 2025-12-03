import type {PropsWithChildren} from 'react';
import {ThemeProvider, type Theme} from '@emotion/react';

// these utils are for stories that have forced dark mode
// which is a very specific sanctioned use case
import {DO_NOT_USE_darkChonkTheme} from 'sentry/utils/theme/theme.chonk';

/**
 * Access the raw values from the dark theme
 *
 * ⚠️ DO NOT USE OUTSIDE OF STORIES
 */
export const useStoryDarkModeTheme = (): Theme => {
  return DO_NOT_USE_darkChonkTheme as any;
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
