import type {Translation} from '../translation/translate';

export interface DateTimePreferences {
  clock: '12' | '24';
  timezone: string;
}

export interface FormattingSnapshot extends DateTimePreferences {
  locale: string;
  messages: Translation;
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

let source: FormattingSource = {
  getSnapshot: () => defaults,
  subscribe: () => () => {},
};

/** Configure one preference and locale source before rendering. */
export function configureFormatting(next: FormattingSource): () => void {
  const previous = source;
  source = next;
  return () => {
    source = previous;
  };
}

export const getSnapshot = () => source.getSnapshot();
export const subscribe = (onChange: () => void) => source.subscribe(onChange);
