import {createStore} from 'reflux';

import type {SidebarPanelKey} from 'sentry/components/sidebar/types';

import type {StrictStoreDefinition} from './types';

type ActivePanelType = Readonly<SidebarPanelKey | ''>;

interface SidebarPanelStoreDefinition extends StrictStoreDefinition<ActivePanelType> {
  activatePanel(panel: SidebarPanelKey): void;

  hidePanel(hash?: string): void;
  togglePanel(panel: SidebarPanelKey): void;
}

const storeConfig: SidebarPanelStoreDefinition = {
  state: '',

  init() {
    // XXX: Do not use `this.listenTo` in this store. We avoid usage of reflux
    // listeners due to their leaky nature in tests.
  },

  activatePanel(panel: SidebarPanelKey) {
    this.state = panel;
    this.trigger(this.state);
  },

  togglePanel(panel: SidebarPanelKey) {
    if (this.state === panel) {
      this.hidePanel();
    } else {
      this.activatePanel(panel);
    }
  },

  hidePanel(hash?: string) {
    this.state = '';

    if (hash) {
      window.location.hash = window.location.hash.replace(`#${hash}`, '');
    }

    this.trigger(this.state);
  },

  getState() {
    return this.state;
  },
};

/**
 * This store is used to hold local user preferences
 * Side-effects (like reading/writing to cookies) are done in associated actionCreators
 */
const SidebarPanelStore = createStore(storeConfig);
export default SidebarPanelStore;
