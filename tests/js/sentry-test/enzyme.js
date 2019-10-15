import {mount, shallow, render} from 'enzyme'; // eslint-disable-line no-restricted-imports
import {ThemeProvider} from 'emotion-theming';
import React from 'react';

import theme from 'app/utils/theme';

const mountWithTheme = (tree, opts) => {
  const WrappingThemeProvider = props => (
    <ThemeProvider theme={theme}>{props.children}</ThemeProvider>
  );

  return mount(tree, {wrappingComponent: WrappingThemeProvider, ...opts});
};

export {mountWithTheme, mount, shallow, render};
