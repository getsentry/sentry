import Reflux from 'reflux';
import SidebarActions from '../actions/sidebarActions';

const SidebarStore = Reflux.createStore({
  init() {
    this.reset();

    this.listenTo(SidebarActions.hideSidebar, this.onHideSidebar);
    this.listenTo(SidebarActions.showSidebar, this.onShowSidebar);
    this.listenTo(SidebarActions.loadInitialState, this.loadInitialState);
  },

  getInitialState() {
    return this._state;
  },

  reset() {
    this._state = {
      collapsed: false,
    };
  },

  loadInitialState(collapsed) {
    this._state.collapsed = collapsed;
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

export default SidebarStore;
