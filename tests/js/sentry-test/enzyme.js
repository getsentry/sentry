import {cache} from '@emotion/css'; // eslint-disable-line emotion/no-vanilla
import {CacheProvider, ThemeProvider} from '@emotion/react';
import {mount, shallow as enzymeShallow} from 'enzyme'; // eslint-disable-line no-restricted-imports

import {act} from 'sentry-test/reactTestingLibrary';

import {lightTheme} from 'sentry/utils/theme';

/**
 * @deprecated
 * As we are migrating our tests to React Testing Library,
 * please avoid using `sentry-test/enzyme/mountWithTheme` and use `sentry-test/reactTestingLibrary/mountWithTheme` instead.
 */
export function mountWithTheme(tree, opts) {
  const WrappingThemeProvider = props => (
    <CacheProvider value={cache}>
      <ThemeProvider theme={lightTheme}>{props.children}</ThemeProvider>
    </CacheProvider>
  );

  return mount(tree, {wrappingComponent: WrappingThemeProvider, ...opts});
}

/**
 * @deprecated
 * As we are migrating our tests to React Testing Library,
 * please avoid using `sentry-test/enzyme/shallow` and use `sentry-test/reactTestingLibrary/mountWithTheme` instead.
 */
export const shallow = enzymeShallow;

/**
 * @deprecated
 * Force the useLegacyStore setState updates to be wrapped in act.
 *
 * This is useful for old-style enzyme tests where enzyme does not correctly
 * wrap things in `act()` for you.
 *
 * Do NOT use this in RTL tests, as setState's triggered by store updates
 * should be captured with RTL style tests.
 */
export function enforceActOnUseLegacyStoreHook() {
  const originalHook = window._legacyStoreHookUpdate;

  beforeEach(() => {
    window._legacyStoreHookUpdate = update => act(update);
  });

  afterEach(() => {
    window._legacyStoreHookUpdate = originalHook;
  });
}
