import {cache} from '@emotion/css'; // eslint-disable-line @emotion/no-vanilla
import {CacheProvider, ThemeProvider} from '@emotion/react';
import {mount, shallow as enzymeShallow} from 'enzyme'; // eslint-disable-line no-restricted-imports

import {lightTheme} from 'sentry/utils/theme';

/**
 * @deprecated
 * As we are migrating our tests to React Testing Library,
 * please avoid using `sentry-test/enzyme/mountWithTheme` and use `sentry-test/reactTestingLibrary/render` instead.
 */
export function mountWithTheme(tree, opts = {}) {
  const WrappingThemeProvider = props => (
    <CacheProvider value={{...cache, compat: true}}>
      <ThemeProvider theme={lightTheme}>
        {opts.wrappingComponent ? (
          <opts.wrappingComponent>{props.children}</opts.wrappingComponent>
        ) : (
          props.children
        )}
      </ThemeProvider>
    </CacheProvider>
  );

  return mount(tree, {...opts, wrappingComponent: WrappingThemeProvider});
}

/**
 * @deprecated
 * As we are migrating our tests to React Testing Library,
 * please avoid using `sentry-test/enzyme/shallow` and use `sentry-test/reactTestingLibrary/render` instead.
 */
export const shallow = enzymeShallow;
