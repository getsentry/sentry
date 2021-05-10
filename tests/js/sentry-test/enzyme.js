import {cache} from '@emotion/css'; // eslint-disable-line emotion/no-vanilla
import {CacheProvider, ThemeProvider} from '@emotion/react';
import {mount, render, shallow} from 'enzyme'; // eslint-disable-line no-restricted-imports

import {lightTheme} from 'app/utils/theme';

const mountWithTheme = (tree, opts) => {
  const WrappingThemeProvider = props => (
    <CacheProvider value={cache}>
      <ThemeProvider theme={lightTheme}>{props.children}</ThemeProvider>
    </CacheProvider>
  );

  return mount(tree, {wrappingComponent: WrappingThemeProvider, ...opts});
};

export {mountWithTheme, render, shallow};
