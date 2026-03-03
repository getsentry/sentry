import {createContext, useContext} from 'react';

import {Token, type TokenResult} from 'sentry/components/searchSyntax/parser';

export type ValueComboboxContextValue = {
  ctrlKeyPressed: boolean;
  selectedValueMap: ReadonlyMap<string, boolean>;
  token: TokenResult<Token.FILTER>;
};

export const ValueComboboxContext = createContext<ValueComboboxContextValue | null>(null);

export function useValueComboboxContext() {
  const context = useContext(ValueComboboxContext);
  if (!context) {
    throw new Error(
      'useValueComboboxContext must be used within SearchQueryBuilderValueCombobox'
    );
  }
  return context;
}
