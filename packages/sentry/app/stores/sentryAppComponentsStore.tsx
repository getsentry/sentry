import {createStore, StoreDefinition} from 'reflux';

import {SentryAppComponent} from 'sentry/types';
import {makeSafeRefluxStore} from 'sentry/utils/makeSafeRefluxStore';

export interface SentryAppComponentsStoreDefinition extends StoreDefinition {
  get: (uuid: string) => SentryAppComponent | undefined;
  getAll: () => SentryAppComponent[];
  getComponentByType: (type: string | undefined) => SentryAppComponent[];
  getInitialState: () => SentryAppComponent[];
  loadComponents: (items: SentryAppComponent[]) => void;
}

const storeConfig: SentryAppComponentsStoreDefinition = {
  unsubscribeListeners: [],
  items: [],

  init() {
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

  getComponentByType(type: string | undefined) {
    if (!type) {
      return this.getAll();
    }
    const items: SentryAppComponent[] = this.items;
    return items.filter(item => item.type === type);
  },
};

const SentryAppComponentsStore = createStore(makeSafeRefluxStore(storeConfig));
export default SentryAppComponentsStore;
