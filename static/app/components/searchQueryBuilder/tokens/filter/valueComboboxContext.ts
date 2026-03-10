import {createContext, useContext, type RefObject} from 'react';

import type {SelectOptionWithKey} from '@sentry/scraps/compactSelect';

import {Token, type TokenResult} from 'sentry/components/searchSyntax/parser';

type ValueComboboxContextValue = {
  canSelectMultipleValues: boolean;
  canUseWildcard: boolean;
  ctrlKeyPressed: boolean;
  inputValue: string;
  isFetching: boolean;
  items: Array<SelectOptionWithKey<string>>;
  onBackFromAbsoluteDate: () => void;
  onSaveAbsoluteDate: (newDateTimeValue: string) => void;
  onSelectAbsoluteDate: (newDateTimeValue: string) => void;
  selectedValueMap: ReadonlyMap<string, boolean>;
  showDatePicker: boolean;
  token: TokenResult<Token.FILTER>;
  wrapperRef: RefObject<HTMLDivElement | null>;
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
