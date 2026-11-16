import moment from 'moment-timezone';
import {createStore} from 'zustand/vanilla';

import type {Config} from 'sentry/types/system';

// When the app is booted we will _immediately_ hydrate the config store,
// effectively ensuring this is not empty.
const store = createStore<Config>()(() => ({}) as Config);

export const ConfigStore = {
  // State is only written through the methods below.
  getState: store.getState,
  getInitialState: store.getInitialState,
  subscribe: store.subscribe,

  /**
   * Empties the config. Only used to reset state between tests.
   */
  init(): void {
    store.setState({} as Config, true);
  },

  get<K extends keyof Config>(key: K): Config[K] {
    return store.getState()[key];
  },

  set<K extends keyof Config>(key: K, value: Config[K]): void {
    store.setState({[key]: value} as Pick<Config, K>);
  },

  loadInitialData(config: Config): void {
    const shouldUseDarkMode = config.user?.options.theme === 'dark';

    const state: Config = {
      ...config,
      features: new Set(config.features || []),
      theme: shouldUseDarkMode ? 'dark' : 'light',
    };

    // TODO(dcramer): abstract this out of ConfigStore
    if (state.user) {
      state.user.permissions = new Set(state.user.permissions);
      moment.tz.setDefault(state.user.options.timezone);
    }

    store.setState(state, true);
  },
};
