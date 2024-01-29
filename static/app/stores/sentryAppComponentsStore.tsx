import type {StoreDefinition} from 'reflux';
import {createStore} from 'reflux';

import type {SentryAppComponent} from 'sentry/types';

export interface SentryAppComponentsStoreDefinition extends StoreDefinition {
  get: (uuid: string) => SentryAppComponent | undefined;
  getAll: () => SentryAppComponent[];
  getInitialState: () => SentryAppComponent[];
  init: () => void;
  loadComponents: (items: SentryAppComponent[]) => void;
}

const storeConfig: SentryAppComponentsStoreDefinition = {
  items: [],

  init() {
    // XXX: Do not use `this.listenTo` in this store. We avoid usage of reflux
    // listeners due to their leaky nature in tests.

    this.items = [];
  },

  getInitialState() {
    return this.items;
  },

  loadComponents(items: SentryAppComponent[]) {
    this.items = items;
    this.trigger(items);
  },

  get(uuid: string) {
    const items: SentryAppComponent[] = this.items;
    return items.find(item => item.uuid === uuid);
  },

  getAll() {
    return this.items;
  },
};

const SentryAppComponentsStore = createStore(storeConfig);
export default SentryAppComponentsStore;
