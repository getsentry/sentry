import {type Theme} from 'sentry/utils/theme';
import {lightTheme, darkTheme} from 'sentry/utils/theme/theme';

export const ThemeFixture = (): Theme => {
  return lightTheme;
};

export const DarkThemeFixture = (): Theme => {
  return darkTheme;
};
