import * as Sentry from '@sentry/react';
import moment from 'moment-timezone';
import {createStore} from 'reflux';

import type {Config} from 'sentry/types/system';

import type {StrictStoreDefinition} from './types';

interface ConfigStoreDefinition extends StrictStoreDefinition<Config> {
  get<K extends keyof Config>(key: K): Config[K];
  loadInitialData(config: Config): void;
  set<K extends keyof Config>(key: K, value: Config[K]): void;
}

const {warn} = Sentry.logger;

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
    if (this.state.user) {
      this.state.user.permissions = new Set(this.state.user.permissions);

      const systemTimeZone = moment.tz.guess();
      const userTimeZone = this.state.user.options.timezone;

      const nowInSystemTimezone = moment.tz(undefined, systemTimeZone);
      const nowInUserTimezone = moment.tz(undefined, userTimeZone);

      if (nowInSystemTimezone.utcOffset() !== nowInUserTimezone.utcOffset()) {
        warn('System time zone does not match user preferences time zone', {
          systemTimeZone,
          userTimeZone,
        });
      }

      moment.tz.setDefault(userTimeZone);
    }

    this.trigger(this.state);
  },

  getState() {
    return this.state;
  },
};

const ConfigStore = createStore(storeConfig);
export default ConfigStore;
