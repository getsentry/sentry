import moment from 'moment-timezone';
import {createStore} from 'reflux';

import type {Config} from 'sentry/types/system';

import type {StrictStoreDefinition} from './types';

interface ConfigStoreDefinition extends StrictStoreDefinition<Config> {
  get<K extends keyof Config>(key: K): Config[K];
  loadInitialData(config: Config): void;
  set<K extends keyof Config>(key: K, value: Config[K]): void;
}

const storeConfig: ConfigStoreDefinition = {
  // When the app is booted we will _immediately_ hydrate the config store,
  // effecively ensuring this is not empty.
  state: {} as Config,

  init(): void {
    // XXX: Do not use `this.listenTo` in this store. We avoid usage of reflux
    // listeners due to their leaky nature in tests.

    this.state = {} as Config;
  },

  get(key) {
    return this.state[key];
  },

  set(key, value) {
    this.state = {...this.state, [key]: value};
    this.trigger({[key]: value});
  },

  loadInitialData(config): void {
    const shouldUseDarkMode = config.user?.options.theme === 'dark';

    this.state = {
      ...config,
      features: new Set(config.features || []),
      theme: shouldUseDarkMode ? 'dark' : 'light',
    };

    // TODO(dcramer): abstract this out of ConfigStore
    if (config.user) {
      config.user.permissions = new Set(config.user.permissions);
      moment.tz.setDefault(config.user.options.timezone);
    }

    this.trigger(config);
  },

  getState() {
    return this.state;
  },
};

const ConfigStore = createStore(storeConfig);
export default ConfigStore;
