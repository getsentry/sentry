import {SidebarPanelKey} from 'sentry/components/sidebar/types';

import {SidebarReducer} from './sidebarProvider';

describe('sidebarReducer', () => {
  it('shows panel', () => {
    expect(
      SidebarReducer('', {
        type: 'show panel',
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
});
