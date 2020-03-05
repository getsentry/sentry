import {mount, shallow, render} from 'enzyme'; // eslint-disable-line no-restricted-imports
import {CacheProvider} from '@emotion/core';
import {ThemeProvider} from 'emotion-theming';
import {cache} from 'emotion'; // eslint-disable-line emotion/no-vanilla
import React from 'react';

import theme from 'app/utils/theme';

const mountWithTheme = (tree, opts) => {
  const WrappingThemeProvider = props => (
    <CacheProvider value={cache}>
      <ThemeProvider theme={theme}>{props.children}</ThemeProvider>
    </CacheProvider>
  );

  return mount(tree, {wrappingComponent: WrappingThemeProvider, ...opts});
};

export {mountWithTheme, mount, shallow, render};
