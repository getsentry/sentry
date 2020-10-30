import Reflux from 'reflux';

import PluginActions from 'app/actions/pluginActions';
import {Plugin} from 'app/types';

type PluginStoreInterface = {
  state: {
    loading: boolean;
    plugins: Plugin[];
    error: any | null;
    pageLinks: string | null;
  };
  plugins: Map<string, Plugin> | null;
  updating: Map<string, Plugin>;
};

const PluginStoreConfig: Reflux.StoreDefinition & PluginStoreInterface = {
  plugins: null,
  state: {
    loading: true,
    plugins: [],
    error: null,
    pageLinks: null,
  },
  updating: new Map(),

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

  triggerState() {
    this.trigger(this.getState());
  },

  onFetchAll({resetLoading}: {resetLoading?: boolean} = {}) {
    if (resetLoading) {
      this.state.loading = true;
      this.state.error = null;
      this.plugins = null;
    }

    this.triggerState();
  },

  onFetchAllSuccess(data: Plugin[], {pageLinks}: {pageLinks?: string}) {
    this.plugins = new Map(data.map(plugin => [plugin.id, plugin]));
    this.state.pageLinks = pageLinks || null;
    this.state.loading = false;
    this.triggerState();
  },

  onFetchAllError(err) {
    this.plugins = null;
    this.state.loading = false;
    this.state.error = err;
    this.triggerState();
  },

  onUpdate(id: string, updateObj: Partial<Plugin>) {
    if (!this.plugins) {
      return;
    }

    const plugin = this.plugins.get(id);
    if (!plugin) {
      return;
    }
    const newPlugin = {
      ...plugin,
      ...updateObj,
    };

    this.plugins.set(id, newPlugin);
    this.updating.set(id, plugin);
    this.triggerState();
  },

  onUpdateSuccess(id: string, _updateObj: Partial<Plugin>) {
    this.updating.delete(id);
  },

  onUpdateError(id: string, _updateObj: Partial<Plugin>, err) {
    const origPlugin = this.updating.get(id);
    if (!origPlugin || !this.plugins) {
      return;
    }

    this.plugins.set(id, origPlugin);
    this.updating.delete(id);
    this.state.error = err;
    this.triggerState();
  },
};

const PluginStore = Reflux.createStore(PluginStoreConfig);

type PluginStore = Reflux.Store & PluginStoreInterface;
export default PluginStore as PluginStore;
