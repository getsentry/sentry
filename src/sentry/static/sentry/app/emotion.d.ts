import '@emotion/react';
import theme from 'app/utils/theme';

type SentryTheme = typeof theme;

declare module '@emotion/react' {
  export interface Theme extends SentryTheme {}
}
