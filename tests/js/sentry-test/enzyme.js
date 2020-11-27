import React from 'react';
import {CacheProvider} from '@emotion/core';
import {cache} from 'emotion'; // eslint-disable-line emotion/no-vanilla
import {ThemeProvider} from 'emotion-theming';
import {mount, render, shallow} from 'enzyme'; // eslint-disable-line no-restricted-imports

import theme from 'app/utils/theme';

const mountWithTheme = (tree, opts) => {
  const WrappingThemeProvider = props => (
    <CacheProvider value={cache}>
      <ThemeProvider theme={theme}>{props.children}</ThemeProvider>
    </CacheProvider>
  );

  return mount(tree, {wrappingComponent: WrappingThemeProvider, ...opts});
};

export {mount, mountWithTheme, render, shallow};
