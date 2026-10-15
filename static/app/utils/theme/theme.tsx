import {
  darkTheme as baseDarkTheme,
  lightTheme as baseLightTheme,
  generateMotion,
  type Theme,
} from '@sentry/scraps/theme';

import {IS_ACCEPTANCE_TEST, NODE_ENV} from 'sentry/constants/env';

// The app controls when animations are disabled; Scraps has no app environment dependency.
const motion = generateMotion(IS_ACCEPTANCE_TEST || NODE_ENV === 'test');

/**
 * @deprecated use useTheme hook instead of directly importing the theme. If you require a theme for your tests, use ThemeFixture.
 */
export const lightTheme: Theme = {...baseLightTheme, motion};

/**
 * @deprecated use useTheme hook instead of directly importing the theme. If you require a theme for your tests, use ThemeFixture.
 */
export const darkTheme: Theme = {...baseDarkTheme, motion};
