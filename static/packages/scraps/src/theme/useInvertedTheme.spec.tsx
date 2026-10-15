import {ThemeProvider} from '@emotion/react';
import {renderHook} from '@testing-library/react';

import {darkTheme, lightTheme, useInvertedTheme} from './index';

it.each([
  [lightTheme, darkTheme],
  [darkTheme, lightTheme],
])('returns the opposite theme', (theme, oppositeTheme) => {
  function Wrapper({children}: {children: React.ReactNode}) {
    return <ThemeProvider theme={theme}>{children}</ThemeProvider>;
  }

  const {result} = renderHook(useInvertedTheme, {wrapper: Wrapper});

  expect(result.current).toBe(oppositeTheme);
});
