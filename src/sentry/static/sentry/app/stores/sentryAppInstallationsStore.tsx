import Reflux from 'reflux';

import {SentryAppInstallation} from 'app/types';

const SentryAppInstallationStore = Reflux.createStore({
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
});

type SentryAppInstallationStoreType = Reflux.Store & {
  load: (items: SentryAppInstallation[]) => void;
  getInitialState: () => SentryAppInstallation[];
};

export default SentryAppInstallationStore as SentryAppInstallationStoreType;
