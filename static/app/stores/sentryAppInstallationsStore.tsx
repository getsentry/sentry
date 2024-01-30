import {createStore} from 'reflux';

import type {CommonStoreDefinition} from 'sentry/stores/types';
import type {SentryAppInstallation} from 'sentry/types';

interface SentryAppInstallationStoreDefinition
  extends CommonStoreDefinition<SentryAppInstallation[]> {
  getInitialState(): SentryAppInstallation[];
  load(items: SentryAppInstallation[]): void;
}

const storeConfig: SentryAppInstallationStoreDefinition = {
  init() {
    // XXX: Do not use `this.listenTo` in this store. We avoid usage of reflux
    // listeners due to their leaky nature in tests.

    this.items = [];
  },

  getState() {
    return this.items;
  },

  getInitialState(): SentryAppInstallation[] {
    return this.items;
  },

  load(items: SentryAppInstallation[]) {
    this.items = items;
    this.trigger(items);
  },

  get(uuid: string) {
    const items: SentryAppInstallation[] = this.items;
    return items.find(item => item.uuid === uuid);
  },

  getAll(): SentryAppInstallation[] {
    return this.items;
  },
};

const SentryAppInstallationStore = createStore(storeConfig);
export default SentryAppInstallationStore;
