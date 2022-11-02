import {createStore} from 'reflux';

import {SidebarPanelKey} from 'sentry/components/sidebar/types';

import {CommonStoreDefinition} from './types';

type ActivePanelType = SidebarPanelKey | '';

interface SidebarPanelStoreDefinition extends CommonStoreDefinition<ActivePanelType> {
  activatePanel(panel: SidebarPanelKey): void;

  activePanel: ActivePanelType;
  hidePanel(): void;
  togglePanel(panel: SidebarPanelKey): void;
}

const storeConfig: SidebarPanelStoreDefinition = {
  activePanel: '',

  init() {
    // XXX: Do not use `this.listenTo` in this store. We avoid usage of reflux
    // listeners due to their leaky nature in tests.
  },

  activatePanel(panel: SidebarPanelKey) {
    this.activePanel = panel;
    this.trigger(this.activePanel);
  },

  togglePanel(panel: SidebarPanelKey) {
    if (this.activePanel === panel) {
      this.hidePanel();
    } else {
      this.activatePanel(panel);
    }
  },

  hidePanel() {
    this.activePanel = '';
    this.trigger(this.activePanel);
  },

  getState() {
    return this.activePanel;
  },
};

/**
 * This store is used to hold local user preferences
 * Side-effects (like reading/writing to cookies) are done in associated actionCreators
 */
const SidebarPanelStore = createStore(storeConfig);
export default SidebarPanelStore;
