import type * as React from 'react';

export interface Translation {
  pgettext: (context: string, message: string) => string;
  t: (
    message: string,
    ...args: Array<React.ReactNode | Record<string, React.ReactNode>>
  ) => string;
  tn: (singular: string, plural: string, count: number) => string;
}

let translation: Translation = {
  t: message => message,
  tn: (singular, plural, count) => (Math.abs(count) === 1 ? singular : plural),
  pgettext: (_context, message) => message,
};

/** Configure the same translations for plain formatters and React presentation. */
export function configureTranslation(next: Translation): () => void {
  const previous = translation;
  translation = next;
  return () => {
    translation = previous;
  };
}

export const t: Translation['t'] = (message, ...args) => translation.t(message, ...args);
export const tn: Translation['tn'] = (singular, plural, count) =>
  translation.tn(singular, plural, count);
export const pgettext: Translation['pgettext'] = (context, message) =>
  translation.pgettext(context, message);
