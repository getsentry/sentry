import {type ReactNode, useCallback, useMemo, useRef, useState} from 'react';
import {Item} from '@react-stately/collections';

import type {SelectOptionWithKey} from 'sentry/components/compactSelect/types';
import {useSearchQueryBuilder} from 'sentry/components/searchQueryBuilder/context';
import {SearchQueryBuilderCombobox} from 'sentry/components/searchQueryBuilder/tokens/combobox';
import type {AggregateFilter} from 'sentry/components/searchSyntax/parser';
import {t} from 'sentry/locale';

type ParametersComboboxProps = {
  onCommit: () => void;
  onDelete: () => void;
  token: AggregateFilter;
};

type SuggestionItem = {
  value: string;
  description?: ReactNode;
  label?: ReactNode;
};

function getInitialInputValue(token: AggregateFilter) {
  if ('args' in token.key) {
    return token.key.args?.text ?? '';
  }

  return '';
}

// TODO(malwilley): Implement parameter suggestions
function useParameterSuggestions(): SelectOptionWithKey<string>[] {
  const parameterSuggestions = useMemo<SuggestionItem[]>(() => {
    return [];
  }, []);

  const createItem = useCallback(
    (suggestion: SuggestionItem): SelectOptionWithKey<string> => {
      return {
        key: suggestion.value,
        label: suggestion.label ?? suggestion.value,
        value: suggestion.value,
        details: suggestion.description,
        textValue: suggestion.value,
        hideCheck: true,
      };
    },
    []
  );

  const items = useMemo(() => {
    return parameterSuggestions.map(createItem);
  }, [createItem, parameterSuggestions]);

  return items;
}

export function SearchQueryBuilderParametersCombobox({
  token,
  onCommit,
}: ParametersComboboxProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const {dispatch} = useSearchQueryBuilder();
  const [inputValue, setInputValue] = useState(() => getInitialInputValue(token));

  const items = useParameterSuggestions();

  const handleInputValueConfirmed = useCallback(
    (value: string) => {
      if (!token.key.args) {
        return;
      }

      dispatch({type: 'UPDATE_AGGREGATE_ARGS', token: token.key.args, value});
      onCommit();
    },
    [dispatch, onCommit, token]
  );

  const handleOptionSelected = useCallback(() => {
    // TODO: Replace value at cursor position
  }, []);

  return (
    <SearchQueryBuilderCombobox
      ref={inputRef}
      items={items}
      onOptionSelected={handleOptionSelected}
      onCustomValueBlurred={handleInputValueConfirmed}
      onCustomValueCommitted={handleInputValueConfirmed}
      onExit={onCommit}
      inputValue={inputValue}
      filterValue=""
      token={token}
      inputLabel={t('Edit function parameters')}
      onInputChange={e => setInputValue(e.target.value)}
      autoFocus
      maxOptions={50}
      openOnFocus
    >
      {items.map(item => (
        <Item {...item} key={item.key}>
          {item.label}
        </Item>
      ))}
    </SearchQueryBuilderCombobox>
  );
}
