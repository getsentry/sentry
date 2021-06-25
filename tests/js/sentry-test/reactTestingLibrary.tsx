import {cache} from '@emotion/css';
import {CacheProvider, ThemeProvider} from '@emotion/react';
import {render, RenderOptions} from '@testing-library/react';

import {lightTheme} from 'app/utils/theme';

const AllTheProviders = ({children}: {children?: React.ReactNode}) => {
  return (
    <CacheProvider value={cache}>
      <ThemeProvider theme={lightTheme}>{children}</ThemeProvider>
    </CacheProvider>
  );
};

const mountWithTheme = (ui: React.ReactElement, options?: RenderOptions) => {
  return render(ui, {wrapper: AllTheProviders, ...options});
};

export * from '@testing-library/react';
export {mountWithTheme};
