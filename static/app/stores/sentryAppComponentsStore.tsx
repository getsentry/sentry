import Reflux from 'reflux';

import SentryAppComponentsActions from 'sentry/actions/sentryAppComponentActions';
import {SentryAppComponent} from 'sentry/types';

type SentryAppComponentsStoreInterface = {
  onLoadComponents: (items: SentryAppComponent[]) => void;
  getComponentByType: (type: string | undefined) => SentryAppComponent[];
  getAll: () => SentryAppComponent[];
  getInitialState: () => SentryAppComponent[];
  get: (uuid: string) => SentryAppComponent | undefined;
};

const storeConfig: Reflux.StoreDefinition & SentryAppComponentsStoreInterface = {
  init() {
    this.items = [];
    this.listenTo(SentryAppComponentsActions.loadComponents, this.onLoadComponents);
  },

  getInitialState() {
    return this.items;
  },

  onLoadComponents(items: SentryAppComponent[]) {
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

const SentryAppComponentsStore = Reflux.createStore(storeConfig) as Reflux.Store &
  SentryAppComponentsStoreInterface;

export default SentryAppComponentsStore;
