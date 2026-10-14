import {ThemeProvider, useTheme} from '@emotion/react';

import {useInvertedTheme} from 'sentry/utils/theme/useInvertedTheme';

export function DarkThemeProvider({children}: {children: React.ReactNode}) {
  const theme = useTheme();
  const invertedTheme = useInvertedTheme();

  return (
    <ThemeProvider theme={theme.type === 'dark' ? theme : invertedTheme}>
      {children}
    </ThemeProvider>
  );
}
