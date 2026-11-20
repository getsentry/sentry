import type * as React from 'react';
import {createContext} from 'react';

import {t, type Translation} from './translate';

export type TranslationContextValue = {
  t: Translation['t'];
  tct: (template: string, components: Record<string, React.ReactNode>) => React.ReactNode;
};

export const TranslationContext = createContext<TranslationContextValue>({
  t,
  tct: template => template,
});
