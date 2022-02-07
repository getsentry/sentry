import Reflux from 'reflux';

import PreferencesActions from 'sentry/actions/preferencesActions';

import {CommonStoreInterface} from './types';

type Preferences = {
  /**
   * Is the sidebar collapsed to the side
   */
  collapsed?: boolean;
};

type PreferenceStoreInterface = CommonStoreInterface<Preferences> & {
  getInitialState(): Preferences;

  loadInitialState(prefs: Preferences): void;
  prefs: Preferences;
  reset(): void;
};

const storeConfig: Reflux.StoreDefinition & PreferenceStoreInterface = {
  prefs: {},

  init() {
    this.reset();

    this.listenTo(PreferencesActions.hideSidebar, this.onHideSidebar);
    this.listenTo(PreferencesActions.showSidebar, this.onShowSidebar);
    this.listenTo(PreferencesActions.loadInitialState, this.loadInitialState);
  },

  getInitialState() {
    return this.prefs;
  },

  reset() {
    this.prefs = {collapsed: false};
  },

  loadInitialState(prefs: Preferences) {
    this.prefs = {...prefs};
    this.trigger(this.prefs);
  },

  onHideSidebar() {
    this.prefs = {...this.prefs, collapsed: true};
    this.trigger(this.prefs);
  },

  onShowSidebar() {
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
const PreferenceStore = Reflux.createStore(storeConfig) as Reflux.Store &
  PreferenceStoreInterface;

export default PreferenceStore;
