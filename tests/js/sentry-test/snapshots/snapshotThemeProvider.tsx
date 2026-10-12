import type {ReactElement} from 'react';
import {ThemeProvider} from '@emotion/react';

import {darkTheme, lightTheme} from 'sentry/utils/theme/theme';

import type {SnapshotTheme} from './snapshotScenarios';

const THEMES = {light: lightTheme, dark: darkTheme};

export function renderWithSnapshotTheme(
  theme: SnapshotTheme,
  children: ReactElement
): ReactElement {
  return <ThemeProvider theme={THEMES[theme]}>{children}</ThemeProvider>;
}
