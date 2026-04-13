import {createContext, useContext, type RefObject} from 'react';

import type {SelectOptionWithKey} from '@sentry/scraps/compactSelect';

import {Token, type TokenResult} from 'sentry/components/searchSyntax/parser';

type ValueComboboxContextValue = {
  ctrlKeyPressed: boolean;
  selectedValueMap: ReadonlyMap<string, boolean>;
  token: TokenResult<Token.FILTER>;
};

type ValueComboboxMenuContextValue = {
  canSelectMultipleValues: boolean;
  canUseWildcard: boolean;
  inputValue: string;
  isFetching: boolean;
  items: Array<SelectOptionWithKey<string>>;
  onBackFromAbsoluteDate: () => void;
  onSaveAbsoluteDate: (newDateTimeValue: string) => void;
  onSelectAbsoluteDate: (newDateTimeValue: string) => void;
  showDatePicker: boolean;
  token: TokenResult<Token.FILTER>;
  wrapperRef: RefObject<HTMLDivElement | null>;
};

export const ValueComboboxContext = createContext<ValueComboboxContextValue | null>(null);
export const ValueComboboxMenuContext =
  createContext<ValueComboboxMenuContextValue | null>(null);

export function useValueComboboxContext() {
  const context = useContext(ValueComboboxContext);
  if (!context) {
    throw new Error(
      'useValueComboboxContext must be used within SearchQueryBuilderValueCombobox'
    );
  }
  return context;
}

export function useValueComboboxMenuContext() {
  const context = useContext(ValueComboboxMenuContext);
  if (!context) {
    throw new Error(
      'useValueComboboxMenuContext must be used within SearchQueryBuilderValueCombobox'
    );
  }
  return context;
}
