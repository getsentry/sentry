import {SidebarPanelKey} from 'sentry/components/sidebar/types';
import SidebarPanelStore from 'sentry/stores/sidebarPanelStore';

describe('TeamStore', () => {
  beforeEach(() => {
    SidebarPanelStore.state = '';
  });

  it('sets the active panel', () => {
    SidebarPanelStore.activatePanel(SidebarPanelKey.REPLAYS_ONBOARDING);
    expect(SidebarPanelStore.getState()).toBe(SidebarPanelKey.REPLAYS_ONBOARDING);
  });

  it('returns a stable reference with getState', () => {
    SidebarPanelStore.activatePanel(SidebarPanelKey.REPLAYS_ONBOARDING);
    const state = SidebarPanelStore.getState();
    expect(Object.is(state, SidebarPanelStore.getState())).toBe(true);
  });
});
