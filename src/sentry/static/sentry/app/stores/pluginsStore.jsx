import Reflux from 'reflux';

import PluginActions from 'app/actions/pluginActions';

const PluginsStore = Reflux.createStore({
  getInitialState() {
    return this.getState();
  },

  getState() {
    const {plugins: _plugins, ...state} = this.state;

    return {
      ...state,
      plugins: this.plugins ? Array.from(this.plugins.values()) : [],
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
      loading: true,
      plugins: [],
      error: null,
      pageLinks: null,
    };
    this.updating = new Map();
    return this.state;
  },

  triggerState() {
    this.trigger(this.getState());
  },

  onFetchAll({resetLoading} = {}) {
    if (resetLoading) {
      this.state.loading = true;
      this.state.error = null;
      this.plugins = null;
    }

    this.triggerState();
  },

  onFetchAllSuccess(data, {pageLinks}) {
    this.plugins = new Map(data.map(plugin => [plugin.id, plugin]));
    this.state.pageLinks = pageLinks;
    this.state.loading = false;
    this.triggerState();
  },

  onFetchAllError(err) {
    this.plugins = null;
    this.state.loading = false;
    this.state.error = err;
    this.triggerState();
  },

  onUpdate(id, updateObj) {
    if (!this.plugins) {
      return;
    }

    const plugin = this.plugins.get(id);
    const newPlugin = {
      ...plugin,
      ...updateObj,
    };

    this.plugins.set(id, newPlugin);
    this.updating.set(id, plugin);
    this.triggerState();
  },

  onUpdateSuccess(id, _updateObj) {
    this.updating.delete(id);
  },

  onUpdateError(id, _updateObj, err) {
    const origPlugin = this.updating.get(id);
    if (!origPlugin) {
      return;
    }

    this.plugins.set(id, origPlugin);
    this.updating.delete(id);
    this.state.error = err;
    this.triggerState();
  },
});

export default PluginsStore;
