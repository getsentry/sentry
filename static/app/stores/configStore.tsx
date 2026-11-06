import moment from 'moment-timezone';
import {createStore} from 'reflux';

import {configureFormatting, type FormattingSnapshot} from '@sentry/scraps/dateTime';

import {getLocaleSnapshot, subscribeLocale} from 'sentry/locale';
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
    if (this.state.user) {
      this.state.user.permissions = new Set(this.state.user.permissions);
      moment.tz.setDefault(this.state.user.options.timezone);
    }

    this.trigger(this.state);
  },

  getState() {
    return this.state;
  },
};

export const ConfigStore = createStore(storeConfig);

let formattingSnapshot: FormattingSnapshot | undefined;

configureFormatting({
  getSnapshot: () => {
    const {locale, messages} = getLocaleSnapshot();
    const user = ConfigStore.get('user');
    const timezone =
      user?.options.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
    const clock = user?.options.clock24Hours ? '24' : '12';
    if (
      !formattingSnapshot ||
      formattingSnapshot.timezone !== timezone ||
      formattingSnapshot.clock !== clock ||
      formattingSnapshot.locale !== locale ||
      formattingSnapshot.messages !== messages
    ) {
      formattingSnapshot = {timezone, clock, locale, messages};
    }
    return formattingSnapshot;
  },
  subscribe: onChange => {
    const unlistenConfig = ConfigStore.listen(onChange, undefined) as () => void;
    const unlistenLocale = subscribeLocale(onChange);
    return () => {
      unlistenConfig();
      unlistenLocale();
    };
  },
});
