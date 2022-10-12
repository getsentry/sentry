import {createStore} from 'reflux';

import {CommonStoreDefinition} from './types';

type Preferences = {
  /**
   * Is the sidebar collapsed to the side
   */
  collapsed?: boolean;
};

interface PreferenceStoreDefinition extends CommonStoreDefinition<Preferences> {
  getInitialState(): Preferences;

  hideSidebar(): void;
  loadInitialState(prefs: Preferences): void;
  prefs: Preferences;
  reset(): void;
  showSidebar(): void;
}

const storeConfig: PreferenceStoreDefinition = {
  prefs: {},

  init() {
    // XXX: Do not use `this.listenTo` in this store. We avoid usage of reflux
    // listeners due to their leaky nature in tests.

    this.reset();
  },

  getInitialState() {
    return this.prefs;
  },

  reset() {
    this.prefs = {collapsed: false};
  },

  loadInitialState(prefs) {
    this.prefs = {...prefs};
    this.trigger(this.prefs);
  },

  hideSidebar() {
    this.prefs = {...this.prefs, collapsed: true};
    this.trigger(this.prefs);
  },

  showSidebar() {
    this.prefs = {...this.prefs, collapsed: false};
    this.trigger(this.prefs);
  },

  getState() {
    return this.prefs;
  },
};

/**
 * This store is used to hold local user preferences
 * Side-effects (like reading/writing to cookies) are done in associated actionCreators
 */
const PreferenceStore = createStore(storeConfig);
export default PreferenceStore;
