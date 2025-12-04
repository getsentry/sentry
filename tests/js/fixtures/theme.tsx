import type {DO_NOT_USE_ChonkTheme} from 'sentry/utils/theme';
import {type Theme} from 'sentry/utils/theme';
import {DO_NOT_USE_lightChonkTheme} from 'sentry/utils/theme/theme';

export const ThemeFixture = (): Theme & DO_NOT_USE_ChonkTheme => {
  return DO_NOT_USE_lightChonkTheme as Theme & DO_NOT_USE_ChonkTheme;
};
