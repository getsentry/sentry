import type * as React from 'react';

import {getSnapshot} from '../dateTime/config';

export interface Translation {
  pgettext: (context: string, message: string) => string;
  t: (
    message: string,
    ...args: Array<React.ReactNode | Record<string, React.ReactNode>>
  ) => string;
  tn: (singular: string, plural: string, count: number) => string;
}

export const t: Translation['t'] = (message, ...args) =>
  getSnapshot().messages.t(message, ...args);
export const tn: Translation['tn'] = (singular, plural, count) =>
  getSnapshot().messages.tn(singular, plural, count);
export const pgettext: Translation['pgettext'] = (context, message) =>
  getSnapshot().messages.pgettext(context, message);
