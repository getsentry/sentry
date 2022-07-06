import moment from 'moment-timezone';
import {createStore} from 'reflux';

import {Config} from 'sentry/types';
import {makeSafeRefluxStore} from 'sentry/utils/makeSafeRefluxStore';

import {CommonStoreDefinition} from './types';

interface InternalConfigStore {
  config: Config;
}

interface ConfigStoreDefinition
  extends CommonStoreDefinition<Config>,
    InternalConfigStore {
  get<K extends keyof Config>(key: K): Config[K];
  getConfig(): Config;
  init(): void;
  loadInitialData(config: Config): void;
  set<K extends keyof Config>(key: K, value: Config[K]): void;
  updateTheme(theme: 'light' | 'dark'): void;
}

const storeConfig: ConfigStoreDefinition = {
  // When the app is booted we will _immediately_ hydrate the config store,
  // effecively ensuring this is not empty.
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

export default createStore(makeSafeRefluxStore(storeConfig));
