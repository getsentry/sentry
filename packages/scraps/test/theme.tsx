import type {ReactNode} from 'react';
import {ThemeProvider} from '@emotion/react';

import {lightTheme} from '@sentry/scraps/theme';

export function ThemeWrapper({children}: {children: ReactNode}) {
  return <ThemeProvider theme={lightTheme}>{children}</ThemeProvider>;
}
