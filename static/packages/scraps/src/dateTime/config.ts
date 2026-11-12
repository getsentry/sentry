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

/** Connect application preferences and locale to the reactive formatting store. */
export function configureFormatting(source: FormattingSource): () => void {
  const previous = store.getState();
  const update = () => store.setState(source.getSnapshot(), true);
  const unsubscribe = source.subscribe(update);
  update();
  return () => {
    unsubscribe();
    store.setState(previous, true);
  };
}

export const getSnapshot = store.getState;
