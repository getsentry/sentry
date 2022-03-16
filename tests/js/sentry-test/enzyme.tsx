import {Component, ReactElement} from 'react';
import {cache} from '@emotion/css'; // eslint-disable-line emotion/no-vanilla
import {CacheProvider, ThemeProvider} from '@emotion/react';
// eslint-disable-next-line no-restricted-imports
import {mount, MountRendererProps, ReactWrapper, shallow as enzymeShallow} from 'enzyme';

import {act} from 'sentry-test/reactTestingLibrary';

import {lightTheme} from 'sentry/utils/theme';

// Enzyme type exports
export {ReactWrapper, ReactElement};

/**
 * @deprecated
 * As we are migrating our tests to React Testing Library,
 * please avoid using `sentry-test/enzyme/mountWithTheme` and use `sentry-test/reactTestingLibrary/render` instead.
 */

export function mountWithTheme<C extends Component, P = C['props'], S = C['state']>(
  node: ReactElement<P>,
  options?: MountRendererProps
): ReactWrapper<P, S, C>;
export function mountWithTheme<P>(
  node: ReactElement<P>,
  options?: MountRendererProps
): ReactWrapper<P, any>;
export function mountWithTheme(tree: ReactElement, options: MountRendererProps = {}) {
  const WrappingThemeProvider = (props: {children: React.ReactNode}) => (
    <CacheProvider value={cache}>
      <ThemeProvider theme={lightTheme}>{props.children}</ThemeProvider>
    </CacheProvider>
  );

  return mount(tree, {wrappingComponent: WrappingThemeProvider, ...options});
}

/**
 * @deprecated
 * As we are migrating our tests to React Testing Library,
 * please avoid using `sentry-test/enzyme/shallow` and use `sentry-test/reactTestingLibrary/render` instead.
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
