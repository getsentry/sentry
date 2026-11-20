import {useCallback, useEffect, useMemo, useRef, useState, type ReactNode} from 'react';
import {Item} from '@react-stately/collections';
import type {ComboBoxState} from '@react-stately/combobox';
import type {ListState} from '@react-stately/list';
import type {KeyboardEvent} from '@react-types/shared';

import type {SelectOptionWithKey} from '@sentry/scraps/compactSelect';
import {getEscapedKey} from '@sentry/scraps/compactSelect';

import {
  ensureSearchFilterArgument,
  isFilterKeySuggestion,
  isSearchFilterParameter,
  replaceConditionalFilterClause,
} from 'sentry/components/arithmeticBuilder/conditionalFilter/conditionalFilter';
import {useConditionalFilterAutocomplete} from 'sentry/components/arithmeticBuilder/conditionalFilter/conditionalFilterAutocomplete';
import type {FunctionArgument} from 'sentry/components/arithmeticBuilder/types';
import {
  useSearchQueryBuilderConfig,
  useSearchQueryBuilderState,
} from 'sentry/components/searchQueryBuilder/context';
import {SearchQueryBuilderCombobox} from 'sentry/components/searchQueryBuilder/tokens/combobox';
import {getKeyLabel} from 'sentry/components/searchQueryBuilder/tokens/filterKeyListBox/getKeyLabel';
import {resolveFilterKey} from 'sentry/components/searchQueryBuilder/tokens/utils';
import type {FocusOverride} from 'sentry/components/searchQueryBuilder/types';
import type {
  AggregateFilter,
  ParseResultToken,
} from 'sentry/components/searchSyntax/parser';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils/defined';
import type {AggregateParameter, FieldDefinition} from 'sentry/utils/fields';
import {FieldKind, FieldValueType} from 'sentry/utils/fields';

import {FunctionDescription} from './functionDescription';
import {replaceCommaSeparatedValue} from './replaceCommaSeparatedValue';
import {useAggregateParamVisual} from './useAggregateParamVisual';
import {getAggregateArgTexts, splitAggregateParameters} from './utils';

type ParametersComboboxProps = {
  onCommit: () => void;
  onDelete: () => void;
  state: ListState<ParseResultToken>;
  token: AggregateFilter;
  onKeyDown?: (
    e: KeyboardEvent,
    extra: {state: ComboBoxState<SelectOptionWithKey<string>>}
  ) => void;
};

type SuggestionItem = {value: string; description?: ReactNode; label?: ReactNode};

function getInitialInputValue(token: AggregateFilter) {
  if ('args' in token.key) {
    return token.key.args?.text ?? '';
  }

  return '';
}

function getParameterAtCursorPosition(
  text: string,
  cursorPosition: number | null
): {parameterIndex: number; parameterStart: number; textValue: string} {
  if (cursorPosition === null) {
    return {parameterIndex: 0, parameterStart: 0, textValue: ''};
  }

  const items = splitAggregateParameters(text);

  let characterCount = 0;
  for (let i = 0; i < items.length; i++) {
    const parameterStart = characterCount;
    characterCount += items[i]!.length + 1;
    if (characterCount > cursorPosition) {
      return {parameterIndex: i, parameterStart, textValue: items[i]!.trim()};
    }
  }

  return {parameterIndex: 0, parameterStart: 0, textValue: ''};
}

function getCursorPositionAtEndOfParameter(text: string, parameterIndex: number): number {
  const items = splitAggregateParameters(text);
  const charactersBefore =
    items.slice(0, parameterIndex).join('').length + parameterIndex;

  return charactersBefore + items[parameterIndex]!.length;
}

/**
 * The search query inside an `_if` filter parameter, without its backticks, and
 * where it starts in the full parameters text. Either backtick may still be missing
 * while the user types.
 */
function getSearchFilterAtParameter(
  parameterText: string,
  parameterStart: number
): {filter: string; filterStart: number} {
  const leadingWhitespace = parameterText.length - parameterText.trimStart().length;
  let filter = parameterText.trim();
  let filterStart = parameterStart + leadingWhitespace;

  if (filter.startsWith('`')) {
    filter = filter.slice(1);
    filterStart += 1;
  }
  if (filter.endsWith('`')) {
    filter = filter.slice(0, -1);
  }

  return {filter, filterStart};
}

function calculateNextFocus(
  state: ListState<ParseResultToken>,
  definition: FieldDefinition | null,
  parameterIndex?: number
): FocusOverride | undefined {
  if (
    defined(parameterIndex) &&
    definition?.kind === FieldKind.FUNCTION &&
    definition.parameters?.length &&
    parameterIndex + 1 < definition.parameters.length
  ) {
    return undefined;
  }

  return state.selectionManager.focusedKey
    ? {itemKey: `${state.selectionManager.focusedKey}`, part: 'value'}
    : undefined;
}

function useSelectionIndex({
  inputRef,
  inputValue,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>;
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
    // oxlint-disable-next-line react/exhaustive-effect-dependencies
  }, [inputValue, updateSelectionIndex]);

  return {selectionIndex, updateSelectionIndex};
}

function useParameterSuggestions({
  parameterDefinition,
}: {
  parameterDefinition: AggregateParameter | undefined;
}): Array<SelectOptionWithKey<string>> {
  const {getFieldDefinition, filterKeys} = useSearchQueryBuilderConfig();

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

        const filterFn: (field: {key: string; valueType: FieldValueType}) => boolean =
          typeof columnTypes === 'function'
            ? columnTypes
            : field => columnTypes.includes(field.valueType);

        return potentialColumns
          .map(col => [col, getFieldDefinition(col.key, {kind: col.kind})] as const)
          .filter(([col, definition]) =>
            filterFn({
              key: col.key,
              valueType: definition?.valueType ?? FieldValueType.STRING,
            })
          )
          .map(([col, definition]) => ({
            value: col.key,
            label: getKeyLabel(col, definition),
          }));
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
  state,
  token,
  onCommit,
  onDelete,
  onKeyDown: passedOnKeyDown,
}: ParametersComboboxProps) {
  const {filterKeys, getFieldDefinition, getSuggestedFilterKey, getTagValues} =
    useSearchQueryBuilderConfig();

  const inputRef = useRef<HTMLInputElement>(null);
  const {dispatch} = useSearchQueryBuilderState();
  const initialValue = getInitialInputValue(token);
  const [inputValue, setInputValue] = useState('');
  const [inputChanged, setInputChanged] = useState(false);

  const placeholder = useAggregateParamVisual({token});

  function updateInputValue(value: string) {
    setInputValue(value);
    setInputChanged(true);
  }

  const {selectionIndex, updateSelectionIndex} = useSelectionIndex({
    inputRef,
    inputValue: initialValue,
  });

  const {
    parameterIndex,
    parameterStart,
    textValue: parameterValue,
  } = getParameterAtCursorPosition(inputValue, selectionIndex);

  const definition = getFieldDefinition(token.key.name.text, {
    aggregateArgs: getAggregateArgTexts(token),
  });
  const parameterDefinition = definition?.parameters?.[parameterIndex];
  const parameterSuggestions = useParameterSuggestions({parameterDefinition});

  // `_if` filter parameters get the same search autocomplete as the equation
  // builder: attribute keys, then values for the key under the cursor.
  const isFilterParameter = isSearchFilterParameter(parameterDefinition);
  const {filter: searchFilter, filterStart: searchFilterStart} =
    getSearchFilterAtParameter(
      splitAggregateParameters(inputValue)[parameterIndex] ?? '',
      parameterStart
    );
  const searchFilterCursor = Math.min(
    Math.max((selectionIndex ?? 0) - searchFilterStart, 0),
    searchFilter.length
  );
  const searchFilterKeys = useMemo<FunctionArgument[]>(
    () =>
      Object.values(filterKeys)
        .filter(filterKey => {
          const kind = getFieldDefinition(filterKey.key)?.kind;
          return kind !== FieldKind.FUNCTION && kind !== FieldKind.EQUATION;
        })
        .map(filterKey => ({
          name: filterKey.key,
          kind: filterKey.kind ?? FieldKind.FIELD,
        })),
    [filterKeys, getFieldDefinition]
  );
  const searchFilterAutocomplete = useConditionalFilterAutocomplete({
    enabled: isFilterParameter,
    filterValue: searchFilter,
    functionArguments: searchFilterKeys,
    getFilterTagValues: getTagValues,
    selectionIndex: searchFilterCursor,
  });

  const items = isFilterParameter ? searchFilterAutocomplete.items : parameterSuggestions;
  const filterValue = isFilterParameter
    ? searchFilterAutocomplete.comboBoxFilterValue
    : parameterValue;

  const onKeyDown = useCallback(
    (
      e: KeyboardEvent,
      {state: passedState}: {state: ComboBoxState<SelectOptionWithKey<string>>}
    ) => {
      if (passedOnKeyDown) {
        passedOnKeyDown(e, {state: passedState});
      }
      // Filter suggestions change as the user types, so reopen the menu after a
      // suggestion closed it.
      if (isFilterParameter && !['Enter', 'Escape', 'Tab'].includes(e.key)) {
        passedState.open();
      }
      // If there's nothing in the input and we hit a delete key, we should focus the filter
      if ((e.key === 'Backspace' || e.key === 'Delete') && !inputRef.current?.value) {
        onDelete();
      }
    },
    [isFilterParameter, onDelete, passedOnKeyDown]
  );

  const handleInputValueConfirmed = useCallback(
    (value: string) => {
      if (inputChanged) {
        const parameters = splitAggregateParameters(value).map((parameter, i) => {
          const parameterDef = definition?.parameters?.[i];
          if (isSearchFilterParameter(parameterDef)) {
            return ensureSearchFilterArgument(parameter);
          }
          return parameterDef?.kind === 'column'
            ? resolveFilterKey({key: parameter, filterKeys, getSuggestedFilterKey})
            : parameter;
        });

        dispatch({
          type: 'UPDATE_AGGREGATE_ARGS',
          token,
          value: parameters.join(','),
          focusOverride: calculateNextFocus(state, definition),
        });

        onCommit();
      }
    },
    [
      inputChanged,
      definition,
      dispatch,
      token,
      onCommit,
      state,
      filterKeys,
      getSuggestedFilterKey,
    ]
  );

  // Keep editing after picking a filter key or value, so the user can finish the
  // clause or add more. The filter is committed with the other parameters.
  const handleSearchFilterOptionSelected = useCallback(
    (option: SelectOptionWithKey<string>) => {
      const {newValue: newFilter, newCursorIndex} = replaceConditionalFilterClause(
        searchFilter,
        searchFilterCursor,
        option.value
      );
      const parameters = splitAggregateParameters(inputValue);
      parameters[parameterIndex] = ensureSearchFilterArgument(newFilter);
      const newValue = parameters.join(',');
      const newCursorPosition =
        parameters.slice(0, parameterIndex).join(',').length +
        (parameterIndex > 0 ? 1 : 0) +
        1 +
        Math.min(newCursorIndex, newFilter.trim().length);

      updateInputValue(newValue);
      if (inputRef.current) {
        inputRef.current.value = newValue;
        inputRef.current.setSelectionRange(newCursorPosition, newCursorPosition);
      }
      updateSelectionIndex();
    },
    // oxlint-disable-next-line react/memo-dependencies
    [inputValue, parameterIndex, searchFilter, searchFilterCursor, updateSelectionIndex]
  );

  const handleOptionSelected = useCallback(
    (option: SelectOptionWithKey<string>) => {
      const newValue = replaceCommaSeparatedValue(
        inputValue,
        selectionIndex,
        option.value
      );

      const focusOverride = calculateNextFocus(state, definition, parameterIndex);

      dispatch({type: 'UPDATE_AGGREGATE_ARGS', token, value: newValue, focusOverride});
      updateInputValue(newValue);
      if (!defined(focusOverride)) {
        const newCursorPosition = getCursorPositionAtEndOfParameter(
          newValue,
          parameterIndex
        );
        if (inputRef.current) {
          inputRef.current.value = newValue;
          inputRef.current.setSelectionRange(newCursorPosition, newCursorPosition);
        }
      }
    },
    // oxlint-disable-next-line react/memo-dependencies
    [dispatch, inputValue, parameterIndex, selectionIndex, token, state, definition]
  );

  return (
    <SearchQueryBuilderCombobox
      ref={inputRef}
      items={items}
      placeholder={placeholder}
      onOptionSelected={
        isFilterParameter ? handleSearchFilterOptionSelected : handleOptionSelected
      }
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
      keepMenuOpenOnSelect={option =>
        isFilterParameter && isFilterKeySuggestion(option.value)
      }
      shouldFilterResults={
        !(
          isFilterParameter &&
          searchFilterAutocomplete.editPhase === 'value' &&
          searchFilterAutocomplete.parsedFilterInput
        )
      }
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
