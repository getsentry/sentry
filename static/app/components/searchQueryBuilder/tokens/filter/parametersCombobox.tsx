import {type ReactNode, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Item} from '@react-stately/collections';
import type {KeyboardEvent} from '@react-types/shared';

import type {SelectOptionWithKey} from 'sentry/components/compactSelect/types';
import {getEscapedKey} from 'sentry/components/compactSelect/utils';
import {useSearchQueryBuilder} from 'sentry/components/searchQueryBuilder/context';
import {SearchQueryBuilderCombobox} from 'sentry/components/searchQueryBuilder/tokens/combobox';
import {FunctionDescription} from 'sentry/components/searchQueryBuilder/tokens/filter/functionDescription';
import {replaceCommaSeparatedValue} from 'sentry/components/searchQueryBuilder/tokens/filter/replaceCommaSeparatedValue';
import type {AggregateFilter} from 'sentry/components/searchSyntax/parser';
import {t} from 'sentry/locale';
import {FieldKind, FieldValueType} from 'sentry/utils/fields';

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

function getParameterAtCursorPosition(
  text: string,
  cursorPosition: number | null
): {parameterIndex: number; textValue: string} {
  if (cursorPosition === null) {
    return {parameterIndex: 0, textValue: ''};
  }

  const items = text.split(',');

  let characterCount = 0;
  for (let i = 0; i < items.length; i++) {
    characterCount += items[i]!.length + 1;
    if (characterCount > cursorPosition) {
      return {parameterIndex: i, textValue: items[i]!.trim()};
    }
  }

  return {parameterIndex: 0, textValue: ''};
}

function getCursorPositionAtEndOfParameter(text: string, parameterIndex: number): number {
  const items = text.split(',');
  const charactersBefore =
    items.slice(0, parameterIndex).join('').length + parameterIndex;

  return charactersBefore + items[parameterIndex]!.length;
}

function useSelectionIndex({
  inputRef,
  inputValue,
}: {
  inputRef: React.RefObject<HTMLInputElement>;
  inputValue: string;
}) {
  const [selectionIndex, setSelectionIndex] = useState<number | null>(
    () => inputValue.length
  );

  const updateSelectionIndex = useCallback(() => {
    setSelectionIndex(inputRef.current?.selectionStart ?? null);
  }, [inputRef]);

  // When the input value changes (due to user input), update the selection index
  useEffect(() => {
    updateSelectionIndex();
  }, [inputValue, updateSelectionIndex]);

  return {
    selectionIndex,
    updateSelectionIndex,
  };
}

function useParameterSuggestions({
  token,
  parameterIndex,
}: {
  parameterIndex: number;
  token: AggregateFilter;
}): Array<SelectOptionWithKey<string>> {
  const {getFieldDefinition, filterKeys} = useSearchQueryBuilder();
  const fieldDefinition = getFieldDefinition(token.key.name.text);

  const parameterDefinition = fieldDefinition?.parameters?.[parameterIndex];

  const parameterSuggestions = useMemo<SuggestionItem[]>(() => {
    switch (parameterDefinition?.kind) {
      case 'column': {
        const potentialColumns = Object.values(filterKeys).filter(filterKey => {
          const fieldDef = getFieldDefinition(filterKey.key);
          return (
            fieldDef?.kind !== FieldKind.EQUATION && fieldDef?.kind !== FieldKind.FUNCTION
          );
        });
        const {columnTypes} = parameterDefinition;

        if (typeof columnTypes === 'function') {
          return potentialColumns
            .filter(col =>
              columnTypes({
                key: col.key,
                valueType:
                  getFieldDefinition(col.key, col.kind)?.valueType ??
                  FieldValueType.STRING,
              })
            )
            .map(col => ({value: col.key, label: col.key}));
        }

        return potentialColumns
          .filter(col =>
            columnTypes.includes(
              getFieldDefinition(col.key)?.valueType ?? FieldValueType.STRING
            )
          )
          .map(col => ({value: col.key, label: col.key}));
      }
      case 'value':
        if (parameterDefinition.options) {
          return parameterDefinition.options.map(option => ({
            value: option.value,
            description: option.label,
          }));
        }
        switch (parameterDefinition.dataType) {
          // TODO(malwilley): Add suggestions for data types
          default:
            return [];
        }
      default:
        return [];
    }
  }, [parameterDefinition, filterKeys, getFieldDefinition]);

  const createItem = useCallback(
    (suggestion: SuggestionItem): SelectOptionWithKey<string> => {
      return {
        key: getEscapedKey(suggestion.value),
        label: suggestion.label ?? suggestion.value,
        value: suggestion.value,
        details: suggestion.description,
        textValue: suggestion.value,
        hideCheck: true,
      };
    },
    []
  );

  // Flat list used for state management
  const items = useMemo(() => {
    return parameterSuggestions.map(createItem);
  }, [createItem, parameterSuggestions]);

  return items;
}

export function SearchQueryBuilderParametersCombobox({
  token,
  onCommit,
  onDelete,
}: ParametersComboboxProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const {dispatch} = useSearchQueryBuilder();
  const initialValue = getInitialInputValue(token);
  const [inputValue, setInputValue] = useState('');
  const [inputChanged, setInputChanged] = useState(false);

  function updateInputValue(value: string) {
    setInputValue(value);
    setInputChanged(true);
  }

  const {selectionIndex, updateSelectionIndex} = useSelectionIndex({
    inputRef,
    inputValue: initialValue,
  });

  const {parameterIndex, textValue: filterValue} = getParameterAtCursorPosition(
    inputValue,
    selectionIndex
  );

  const items = useParameterSuggestions({token, parameterIndex});

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // If there's nothing in the input and we hit a delete key, we should focus the filter
      if ((e.key === 'Backspace' || e.key === 'Delete') && !inputRef.current?.value) {
        onDelete();
      }
    },
    [onDelete]
  );

  const handleInputValueConfirmed = useCallback(
    (value: string) => {
      if (inputChanged) {
        dispatch({
          type: 'UPDATE_AGGREGATE_ARGS',
          token,
          value,
        });

        onCommit();
      }
    },
    [inputChanged, dispatch, onCommit, token]
  );

  const handleOptionSelected = useCallback(
    (option: SelectOptionWithKey<string>) => {
      const newValue = replaceCommaSeparatedValue(
        inputValue,
        selectionIndex,
        option.value
      );

      dispatch({
        type: 'UPDATE_AGGREGATE_ARGS',
        token,
        value: newValue,
      });
      updateInputValue(newValue);
      const newCursorPosition = getCursorPositionAtEndOfParameter(
        newValue,
        parameterIndex
      );
      if (inputRef.current) {
        inputRef.current.value = newValue;
        inputRef.current.setSelectionRange(newCursorPosition, newCursorPosition);
      }
    },
    [dispatch, inputValue, parameterIndex, selectionIndex, token]
  );

  return (
    <SearchQueryBuilderCombobox
      ref={inputRef}
      items={items}
      placeholder={initialValue}
      onOptionSelected={handleOptionSelected}
      onCustomValueBlurred={handleInputValueConfirmed}
      onCustomValueCommitted={handleInputValueConfirmed}
      onExit={onCommit}
      inputValue={inputValue}
      filterValue={filterValue}
      token={token}
      inputLabel={t('Edit function parameters')}
      onInputChange={e => updateInputValue(e.target.value)}
      onKeyDown={onKeyDown}
      onKeyUp={updateSelectionIndex}
      onClick={updateSelectionIndex}
      autoFocus
      maxOptions={20}
      isOpen
      description={<FunctionDescription token={token} parameterIndex={parameterIndex} />}
    >
      {item => (
        <Item {...item} key={item.key}>
          {item.label}
        </Item>
      )}
    </SearchQueryBuilderCombobox>
  );
}
