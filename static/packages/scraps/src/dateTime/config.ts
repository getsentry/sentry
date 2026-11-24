import {createStore} from 'zustand/vanilla';

import type {Translation} from '../translation/translate';

export interface DateTimePreferences {
  clock: '12' | '24';
  timezone: string;
}

export interface FormattingSnapshot extends DateTimePreferences {
  locale: string;
  messages: Translation;
  /** Optional application label source. Returning undefined falls back to Intl. */
  getTimezoneAbbreviation?: (
    epochMilliseconds: number,
    timezone: string,
    locale: string
  ) => string | undefined;
}

export interface FormattingSource {
  getSnapshot: () => Readonly<FormattingSnapshot>;
  subscribe: (onChange: () => void) => () => void;
}

const defaults: FormattingSnapshot = {
  timezone: 'UTC',
  clock: '12',
  locale: 'en',
  messages: {
    t: (message, ...args) =>
      message.replace(/%s/g, () => {
        const value = args.shift();
        return typeof value === 'string' || typeof value === 'number' ? `${value}` : '%s';
      }),
    tn: (singular, plural, count) => (Math.abs(count) === 1 ? singular : plural),
    pgettext: (_context, message) => message,
  },
};

const store = createStore<Readonly<FormattingSnapshot>>(() => defaults);

export const formattingStore = {
  getState: store.getState,
  getInitialState: store.getState,
  subscribe: store.subscribe,
};

/**
 * Intl throws a RangeError for a malformed tag such as `en_US`, which would
 * crash every render that formats a date. Gettext-style tags are converted, and
 * anything still invalid falls back to the default locale.
 */
function toIntlLocale(locale: string): string {
  try {
    return Intl.getCanonicalLocales(locale.replaceAll('_', '-'))[0] ?? defaults.locale;
  } catch (error) {
    if (error instanceof RangeError) {
      return defaults.locale;
    }
    throw error;
  }
}

/** Connect application preferences and locale to the reactive formatting store. */
export function configureFormatting(source: FormattingSource): () => void {
  const previous = store.getState();
  let lastSnapshot: Readonly<FormattingSnapshot> | undefined;
  const update = () => {
    const snapshot = source.getSnapshot();
    if (snapshot === lastSnapshot) {
      return;
    }
    lastSnapshot = snapshot;
    const locale = toIntlLocale(snapshot.locale);
    store.setState(locale === snapshot.locale ? snapshot : {...snapshot, locale}, true);
  };
  const unsubscribe = source.subscribe(update);
  update();
  return () => {
    unsubscribe();
    store.setState(previous, true);
  };
}

export const getSnapshot = store.getState;
