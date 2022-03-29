import Reflux from 'reflux';

import {SentryAppInstallation} from 'sentry/types';
import {makeSafeRefluxStore} from 'sentry/utils/makeSafeRefluxStore';

type SentryAppInstallationStoreInterface = {
  getInitialState(): SentryAppInstallation[];
  load(items: SentryAppInstallation[]): void;
};

const storeConfig: Reflux.StoreDefinition & SentryAppInstallationStoreInterface = {
  init() {
    this.items = [];
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

const SentryAppInstallationStore = Reflux.createStore(
  makeSafeRefluxStore(storeConfig)
) as Reflux.Store & SentryAppInstallationStoreInterface;

export default SentryAppInstallationStore;
