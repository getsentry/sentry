import {createStore, StoreDefinition} from 'reflux';

import {Plugin} from 'sentry/types';

interface InternalDefinition {
  plugins: Map<string, Plugin> | null;
  state: {
    error: Error | null;
    loading: boolean;
    pageLinks: string | null;
    plugins: Plugin[];
  };
  updating: Map<string, Plugin>;
}

interface PluginStoreDefinition extends StoreDefinition, InternalDefinition {
  onFetchAll: (options?: {resetLoading?: boolean}) => void;
  onFetchAllError: (err) => void;
  onFetchAllSuccess: (data: Plugin[], links: {pageLinks?: string}) => void;

  onUpdate: (id: string, updateObj: Partial<Plugin>) => void;
  onUpdateError: (id: string, _updateObj: Partial<Plugin>, err) => void;
  onUpdateSuccess: (id: string, _updateObj: Partial<Plugin>) => void;
}

const defaultState = {
  loading: true,
  plugins: [],
  error: null,
  pageLinks: null,
};

const storeConfig: PluginStoreDefinition = {
  plugins: null,
  state: {...defaultState},
  updating: new Map(),

  reset() {
    // reset our state
    this.plugins = null;
    this.state = {...defaultState};
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
    // XXX: Do not use `this.listenTo` in this store. We avoid usage of reflux
    // listeners due to their leaky nature in tests.

    this.reset();
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

const PluginStore = createStore(storeConfig);
export default PluginStore;
