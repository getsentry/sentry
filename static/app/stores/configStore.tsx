import moment from 'moment-timezone';
import {createStore} from 'zustand/vanilla';

import {configureFormatting, type FormattingSnapshot} from '@sentry/scraps/dateTime';

import {getLocaleSnapshot, subscribeLocale} from 'sentry/locale';
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

let formattingSnapshot: FormattingSnapshot | undefined;
const getTimezoneAbbreviation = (
  epochMilliseconds: number,
  timezone: string,
  locale: string
) => {
  const abbreviation = moment.tz.zone(timezone)?.abbr(epochMilliseconds);
  return abbreviation === undefined
    ? undefined
    : moment.localeData(locale).postformat(abbreviation);
};

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
      formattingSnapshot = {timezone, clock, locale, messages, getTimezoneAbbreviation};
    }
    return formattingSnapshot;
  },
  subscribe: onChange => {
    const unlistenConfig = ConfigStore.subscribe(onChange);
    const unlistenLocale = subscribeLocale(onChange);
    return () => {
      unlistenConfig();
      unlistenLocale();
    };
  },
});
