import React from 'react';
import {ThemeProvider} from 'emotion-theming';
import {CacheProvider} from '@emotion/core';
import {render} from '@testing-library/react';
import {cache} from 'emotion'; // eslint-disable-line emotion/no-vanilla

import theme from 'app/utils/theme';

const customRender = (node: React.ReactElement<any>, ...options: Array<any>) => {
  return render(
    <CacheProvider value={cache}>
      <ThemeProvider theme={theme}>{node}</ThemeProvider>
    </CacheProvider>,
    ...options
  );
};

export * from '@testing-library/react';
export {customRender as renderWithTheme};
