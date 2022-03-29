import Reflux from 'reflux';

import SentryAppComponentsActions from 'sentry/actions/sentryAppComponentActions';
import {SentryAppComponent} from 'sentry/types';
import {makeSafeRefluxStore, SafeStoreDefinition} from 'sentry/utils/makeSafeRefluxStore';

type SentryAppComponentsStoreInterface = {
  get: (uuid: string) => SentryAppComponent | undefined;
  getAll: () => SentryAppComponent[];
  getComponentByType: (type: string | undefined) => SentryAppComponent[];
  getInitialState: () => SentryAppComponent[];
  onLoadComponents: (items: SentryAppComponent[]) => void;
};

const storeConfig: Reflux.StoreDefinition &
  SentryAppComponentsStoreInterface &
  SafeStoreDefinition = {
  unsubscribeListeners: [],

  init() {
    this.items = [];
    this.unsubscribeListeners.push(
      this.listenTo(SentryAppComponentsActions.loadComponents, this.onLoadComponents)
    );
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

const SentryAppComponentsStore = Reflux.createStore(
  makeSafeRefluxStore(storeConfig)
) as Reflux.Store & SentryAppComponentsStoreInterface;

export default SentryAppComponentsStore;
