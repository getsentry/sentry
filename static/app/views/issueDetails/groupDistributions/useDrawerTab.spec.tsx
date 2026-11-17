import {act, renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {DrawerTab} from './types';
import {useDrawerTab} from './useDrawerTab';

function renderDrawerTab(query: Record<string, string>, enabled = true) {
  return renderHookWithProviders(() => useDrawerTab({enabled}), {
    initialRouterConfig: {
      location: {pathname: '/organizations/org-slug/issues/1/', query},
    },
  });
}

describe('useDrawerTab', () => {
  it('defaults to tags', () => {
    const {result} = renderDrawerTab({});
    expect(result.current.tab).toBe(DrawerTab.TAGS);
  });

  it('reads type', () => {
    const {result} = renderDrawerTab({type: DrawerTab.FEATURE_FLAGS});
    expect(result.current.tab).toBe(DrawerTab.FEATURE_FLAGS);
  });

  it('always shows tags when feature flags are disabled', () => {
    const {result} = renderDrawerTab({type: DrawerTab.FEATURE_FLAGS}, false);
    expect(result.current.tab).toBe(DrawerTab.TAGS);
  });

  it('writes type and leaves the tab param alone', async () => {
    const {result, router} = renderDrawerTab({tab: 'replays'});

    await act(() => result.current.setTab(DrawerTab.FEATURE_FLAGS));

    await waitFor(() =>
      expect(router.location.query).toEqual({
        tab: 'replays',
        type: DrawerTab.FEATURE_FLAGS,
      })
    );
  });
});
