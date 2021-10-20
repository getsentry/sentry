import {cache} from '@emotion/css'; // eslint-disable-line emotion/no-vanilla
import {CacheProvider, ThemeProvider} from '@emotion/react';
import {mount, shallow as enzymeShallow} from 'enzyme'; // eslint-disable-line no-restricted-imports

import {lightTheme} from 'app/utils/theme';

/**
 * @deprecated
 * As we are migrating our tests to React Testing Library,
 * please avoid using `sentry-test/enzyme/mountWithTheme` and use `sentry-test/reactTestingLibrary/mountWithTheme` instead.
 */
const mountWithTheme = (tree, opts) => {
  const WrappingThemeProvider = props => (
    <CacheProvider value={cache}>
      <ThemeProvider theme={lightTheme}>{props.children}</ThemeProvider>
    </CacheProvider>
  );

  return mount(tree, {wrappingComponent: WrappingThemeProvider, ...opts});
};

/**
 * @deprecated
 * As we are migrating our tests to React Testing Library,
 * please avoid using `sentry-test/enzyme/shallow` and use `sentry-test/reactTestingLibrary/mountWithTheme` instead.
 */
const shallow = enzymeShallow;

export {mountWithTheme, shallow};
