import {createStore} from 'reflux';

import type {Plugin} from 'sentry/types/integrations';

import type {StrictStoreDefinition} from './types';

type State = {
  error: Error | null;
  loading: boolean;
  pageLinks: string | null;
  plugins: Plugin[];
};

interface PluginsStoreDefinition extends StrictStoreDefinition<State> {
  onFetchAllError(err: Error): void;
  onFetchAllSuccess(data: Plugin[], options: {pageLinks?: string | null}): void;
  onFetchAllStart(): void;
  reset(): void;
  triggerState(): void;
}

const storeConfig: PluginsStoreDefinition = {
  plugins: new Map<string, Plugin>(),

  state: {
    plugins: [],
    loading: true,
    error: null,
    pageLinks: null,
  },

  init() {
    // XXX: Do not use `this.listenTo` in this store. We avoid usage of reflux
    // listeners due to their leaky nature in tests.
    this.reset();
  },

  reset() {
    this.plugins = new Map();
    this.state = {
      plugins: [],
      loading: true,
      error: null,
      pageLinks: null,
    };
  },

  triggerState() {
    this.trigger({
      ...this.state,
      plugins: this.plugins ? [...this.plugins.values()] : [],
    });
  },

  onFetchAllStart() {
    this.state.loading = true;
    this.state.error = null;
    this.triggerState();
  },

  onFetchAllSuccess(data: Plugin[], {pageLinks}: {pageLinks?: string | null}) {
    const dataArray = Array.isArray(data) ? data : [];
    this.plugins = new Map(dataArray.map(plugin => [plugin.id, plugin]));
    this.state.pageLinks = pageLinks || null;
    this.state.loading = false;
    this.triggerState();
  },

  onFetchAllError(err: Error) {
    this.plugins = null;
    this.state.loading = false;
    this.state.error = err;
    this.triggerState();
  },

  getState() {
    return {
      ...this.state,
      plugins: this.plugins ? [...this.plugins.values()] : [],
    };
  },
};

const PluginsStore = createStore(storeConfig);
export default PluginsStore;