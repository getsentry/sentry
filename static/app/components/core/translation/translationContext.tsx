import {createContext} from 'react';

export type TranslationContextValue = {
  t: (
    string: string,
    ...args: Array<React.ReactNode | Record<string, React.ReactNode>>
  ) => string;
  tct: (template: string, components: Record<string, React.ReactNode>) => React.ReactNode;
};

export const TranslationContext = createContext<TranslationContextValue>({
  t: string => string,
  tct: template => template,
});
