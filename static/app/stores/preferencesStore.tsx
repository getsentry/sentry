import {createStore} from 'reflux';

import type {StrictStoreDefinition} from './types';

type Preferences = {
  /**
   * Is the sidebar collapsed to the side
   */
  collapsed?: boolean;
};

interface PreferenceStoreDefinition extends StrictStoreDefinition<Preferences> {
  hideSidebar(): void;
  loadInitialState(prefs: Preferences): void;
  reset(): void;
  showSidebar(): void;
}

const storeConfig: PreferenceStoreDefinition = {
  state: {},

  init() {
    // XXX: Do not use `this.listenTo` in this store. We avoid usage of reflux
    // listeners due to their leaky nature in tests.

    this.reset();
  },

  reset() {
    this.state = {collapsed: false};
  },

  loadInitialState(prefs) {
    this.state = {...prefs};
    this.trigger(this.state);
  },

  hideSidebar() {
    this.state = {...this.state, collapsed: true};
    this.trigger(this.state);
  },

  showSidebar() {
    this.state = {...this.state, collapsed: false};
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
const PreferenceStore = createStore(storeConfig);
export default PreferenceStore;
