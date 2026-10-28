import {act, renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import {
  PrimaryNavigationContextProvider,
  usePrimaryNavigation,
} from 'sentry/views/navigation/primaryNavigationContext';

describe('PrimaryNavigationContextProvider', () => {
  it('uses the group of the current route by default', () => {
    const {result} = renderHookWithProviders(usePrimaryNavigation, {
      additionalWrapper: PrimaryNavigationContextProvider,
      initialRouterConfig: {location: {pathname: '/organizations/org-slug/issues/'}},
    });

    expect(result.current.activeGroup).toBe('issues');
  });

  it('lets the active group be overridden within the current route group', () => {
    const {result} = renderHookWithProviders(usePrimaryNavigation, {
      additionalWrapper: PrimaryNavigationContextProvider,
      initialRouterConfig: {location: {pathname: '/organizations/org-slug/issues/'}},
    });

    act(() => result.current.setActiveGroup('explore'));

    expect(result.current.activeGroup).toBe('explore');
  });

  it('drops the override once the route group changes, even when returning', () => {
    const {result, router} = renderHookWithProviders(usePrimaryNavigation, {
      additionalWrapper: PrimaryNavigationContextProvider,
      initialRouterConfig: {location: {pathname: '/organizations/org-slug/issues/'}},
    });

    act(() => result.current.setActiveGroup('explore'));
    expect(result.current.activeGroup).toBe('explore');

    act(() => router.navigate('/settings/org-slug/'));
    expect(result.current.activeGroup).toBe('settings');

    act(() => router.navigate('/organizations/org-slug/issues/'));
    expect(result.current.activeGroup).toBe('issues');
  });
});
