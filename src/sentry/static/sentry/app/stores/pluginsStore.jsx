import Reflux from 'reflux';

import PluginActions from '../actions/pluginActions';

const PluginsStore = Reflux.createStore({
  getInitialState() {
    return this.getState();
  },

  getState() {
    let {
      //eslint-disable-next-line no-unused-vars
      plugins,
      ...state
    } = this.state;

    return {
      ...state,
      plugins: this.plugins ? Array.from(this.plugins.values()) : this.plugins,
    };
  },

  init() {
    this.reset();
    this.listenTo(PluginActions.fetchAll, this.onFetchAll);
    this.listenTo(PluginActions.fetchAllSuccess, this.onFetchAllSuccess);
    this.listenTo(PluginActions.fetchAllError, this.onFetchAllError);
    this.listenTo(PluginActions.update, this.onUpdate);
    this.listenTo(PluginActions.updateSuccess, this.onUpdateSuccess);
    this.listenTo(PluginActions.updateError, this.onUpdateError);
  },

  reset() {
    this.plugins = null;
    this.state = {
      plugins: null,
      error: null,
      pageLinks: null,
    };
    this.updating = new Map();
    return this.state;
  },

  triggerState() {
    this.trigger(this.getState());
  },

  onFetchAll({noReset} = {}) {
    if (!noReset) {
      this.plugins = null;
    }

    this.triggerState();
  },

  onFetchAllSuccess(data, {pageLinks}) {
    this.plugins = new Map(data.map(plugin => [plugin.id, plugin]));
    this.state.pageLinks = pageLinks;
    this.triggerState();
  },

  onFetchAllError(err) {
    this.plugins = null;
    this.state.error = err;
    this.triggerState();
  },

  onUpdate(id, updateObj) {
    if (!this.plugins) return;

    let plugin = this.plugins.get(id);
    let newPlugin = {
      ...plugin,
      ...updateObj,
    };

    this.plugins.set(id, newPlugin);
    this.updating.set(id, plugin);
    this.triggerState();
  },

  onUpdateSuccess(id, updateObj) {
    this.updating.delete(id);
  },

  onUpdateError(id, updateObj, err) {
    let origPlugin = this.updating.get(id);
    if (!origPlugin) return;

    this.plugins.set(id, origPlugin);
    this.updating.delete(id);
    this.state.error = err;
    this.triggerState();
  },
});

export default PluginsStore;
