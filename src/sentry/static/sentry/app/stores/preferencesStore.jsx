import Reflux from 'reflux';
import PreferencesActions from '../actions/preferencesActions';

/**
 * This store is used to hold local user preferences
 * Side-effects (like reading/writing to cookies) are done in associated actionCreators
 */
const PreferencesStore = Reflux.createStore({
  init() {
    this.reset();

    this.listenTo(PreferencesActions.hideSidebar, this.onHideSidebar);
    this.listenTo(PreferencesActions.showSidebar, this.onShowSidebar);
    this.listenTo(PreferencesActions.loadInitialState, this.loadInitialState);
  },

  getInitialState() {
    return this._state;
  },

  reset() {
    this._state = {
      collapsed: false,
    };
  },

  loadInitialState(state) {
    this._state = {...state};
    this.trigger(this._state);
  },

  onHideSidebar() {
    this._state.collapsed = true;
    this.trigger(this._state);
  },

  onShowSidebar() {
    this._state.collapsed = false;
    this.trigger(this._state);
  },
});

export default PreferencesStore;
