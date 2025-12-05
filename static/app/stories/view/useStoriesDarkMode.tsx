import type {PropsWithChildren} from 'react';
import {ThemeProvider, type Theme} from '@emotion/react';

// these utils are for stories that have forced dark mode
// which is a very specific sanctioned use case
// eslint-disable-next-line no-restricted-imports
import {darkTheme} from 'sentry/utils/theme/theme';

/**
 * Access the raw values from the dark theme
 *
 * ⚠️ DO NOT USE OUTSIDE OF STORIES
 */
export const useStoryDarkModeTheme = (): Theme => {
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
