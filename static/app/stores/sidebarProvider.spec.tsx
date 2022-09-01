import {SidebarPanelKey} from 'sentry/components/sidebar/types';

import {SidebarReducer} from './sidebarProvider';

describe('sidebarReducer', () => {
  it('activates panel', () => {
    expect(
      SidebarReducer('', {
        type: 'activate panel',
        payload: SidebarPanelKey.PerformanceOnboarding,
      })
    ).toBe(SidebarPanelKey.PerformanceOnboarding);
  });

  it('hides panel', () => {
    expect(
      SidebarReducer(SidebarPanelKey.PerformanceOnboarding, {
        type: 'hide panel',
      })
    ).toBe('');
  });

  it('toggles panel hides panel if it is currently open', () => {
    expect(
      SidebarReducer(SidebarPanelKey.PerformanceOnboarding, {
        type: 'toggle panel',
        payload: SidebarPanelKey.PerformanceOnboarding,
      })
    ).toBe('');
  });

  it('toggles panel shiows panel if it is not currently open', () => {
    expect(
      SidebarReducer(SidebarPanelKey.Broadcasts, {
        type: 'toggle panel',
        payload: SidebarPanelKey.PerformanceOnboarding,
      })
    ).toBe(SidebarPanelKey.PerformanceOnboarding);
  });
});
