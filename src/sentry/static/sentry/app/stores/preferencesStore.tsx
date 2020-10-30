import Reflux from 'reflux';

import PreferencesActions from '../actions/preferencesActions';

type Preferences = {
  /**
   * Is the sidebar collapsed to the side
   */
  collapsed: boolean;
};

type PreferenceStoreInterface = {
  prefs: Preferences;

  getInitialState(): Preferences;
  reset(): void;
  loadInitialState(prefs: Preferences): void;
};

const preferenceStoreConfig: Reflux.StoreDefinition & PreferenceStoreInterface = {
  prefs: {} as Preferences,

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
    this.prefs = {
      collapsed: false,
    };
  },

  loadInitialState(prefs: Preferences) {
    this.prefs = {...prefs};
    this.trigger(this.prefs);
  },

  onHideSidebar() {
    this.prefs.collapsed = true;
    this.trigger(this.prefs);
  },

  onShowSidebar() {
    this.prefs.collapsed = false;
    this.trigger(this.prefs);
  },
};

type PreferenceStore = Reflux.Store & PreferenceStoreInterface;

/**
 * This store is used to hold local user preferences
 * Side-effects (like reading/writing to cookies) are done in associated actionCreators
 */
export default Reflux.createStore(preferenceStoreConfig) as PreferenceStore;
