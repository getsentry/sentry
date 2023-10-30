import moment from 'moment-timezone';
import {createStore} from 'reflux';

import {Config} from 'sentry/types';

import {CommonStoreDefinition} from './types';

interface InternalConfigStore {
  config: Config;
}

interface ConfigStoreDefinition
  extends CommonStoreDefinition<Config>,
    InternalConfigStore {
  get<K extends keyof Config>(key: K): Config[K];
  init(): void;
  loadInitialData(config: Config): void;
  set<K extends keyof Config>(key: K, value: Config[K]): void;
}

const storeConfig: ConfigStoreDefinition = {
  // When the app is booted we will _immediately_ hydrate the config store,
  // effecively ensuring this is not empty.
  config: {} as Config,

  init(): void {
    // XXX: Do not use `this.listenTo` in this store. We avoid usage of reflux
    // listeners due to their leaky nature in tests.

    this.config = {} as Config;
  },

  get(key) {
    return this.config[key];
  },

  set(key, value) {
    this.config = {...this.config, [key]: value};
    this.trigger({[key]: value});
  },

  loadInitialData(config): void {
    const shouldUseDarkMode = config.user?.options.theme === 'dark';

    this.config = {
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
    return this.config;
  },
};

const ConfigStore = createStore(storeConfig);
export default ConfigStore;
