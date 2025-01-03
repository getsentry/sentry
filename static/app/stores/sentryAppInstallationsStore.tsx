import {createStore} from 'reflux';

import type {SentryAppInstallation} from 'sentry/types/integrations';

import type {StrictStoreDefinition} from 'sentry/stores/types';

interface SentryAppInstallationStoreDefinition
  extends StrictStoreDefinition<SentryAppInstallation[]> {
  load(items: SentryAppInstallation[]): void;
}

const storeConfig: SentryAppInstallationStoreDefinition = {
  state: [],
  init() {
    // XXX: Do not use `this.listenTo` in this store. We avoid usage of reflux
    // listeners due to their leaky nature in tests.

    this.state = [];
  },

  getState() {
    return this.state;
  },

  load(items: SentryAppInstallation[]) {
    this.state = items;
    this.trigger(items);
  },
};

const SentryAppInstallationStore = createStore(storeConfig);
export default SentryAppInstallationStore;
