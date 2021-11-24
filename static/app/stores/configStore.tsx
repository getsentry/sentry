import moment from 'moment-timezone';
import Reflux from 'reflux';

import {Config} from 'sentry/types';

import {CommonStoreInterface} from './types';

type ConfigStoreInterface = CommonStoreInterface<Config> & {
  get<K extends keyof Config>(key: K): Config[K];
  set<K extends keyof Config>(key: K, value: Config[K]): void;
  getConfig(): Config;
  updateTheme(theme: 'light' | 'dark'): void;
  loadInitialData(config: Config): void;
};

type Internals = {
  config: Config;
};

const storeConfig: Reflux.StoreDefinition & Internals & ConfigStoreInterface = {
  // When the app is booted we will _immediately_ hydrate the config store,
  // effecively ensureing this is not empty.
  config: {} as Config,

  init(): void {
    this.config = {} as Config;
  },

  get(key) {
    return this.config[key];
  },

  set(key, value) {
    this.config = {
      ...this.config,
      [key]: value,
    };
    this.trigger({[key]: value});
  },

  /**
   * This is only called by media query listener so that we can control
   * the auto switching of color schemes without affecting manual toggle
   */
  updateTheme(theme) {
    if (this.config.user?.options.theme !== 'system') {
      return;
    }

    this.set('theme', theme);
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

  getConfig() {
    return this.config;
  },

  getState() {
    return this.config;
  },
};

const ConfigStore = Reflux.createStore(storeConfig) as Reflux.Store &
  ConfigStoreInterface;

export default ConfigStore;
