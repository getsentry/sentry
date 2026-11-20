import {Fragment, useCallback, useLayoutEffect, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {Item, Section} from '@react-stately/collections';
import type {ListState} from '@react-stately/list';
import type {KeyboardEvent} from '@react-types/shared';

import type {SelectOptionWithKey} from '@sentry/scraps/compactSelect';
import {Flex} from '@sentry/scraps/layout';

import {
  ensureSearchFilterArgument,
  isFilterKeySuggestion,
  isSearchFilterParameter,
  replaceConditionalFilterClause,
  unwrapSearchFilterArgument,
} from 'sentry/components/arithmeticBuilder/conditionalFilter/conditionalFilter';
import {useConditionalFilterAutocomplete} from 'sentry/components/arithmeticBuilder/conditionalFilter/conditionalFilterAutocomplete';
import type {FunctionArgument} from 'sentry/components/arithmeticBuilder/types';
import {
  useSearchQueryBuilderConfig,
  useSearchQueryBuilderState,
} from 'sentry/components/searchQueryBuilder/context';
import {SearchQueryBuilderCombobox} from 'sentry/components/searchQueryBuilder/tokens/combobox';
import {
  itemIsSection,
  resolveFilterKey,
} from 'sentry/components/searchQueryBuilder/tokens/utils';
import type {
  AggregateFilter,
  ParseResultToken,
} from 'sentry/components/searchSyntax/parser';
import {t} from 'sentry/locale';
import type {AggregateParameter, FieldDefinition} from 'sentry/utils/fields';
import {FieldKind} from 'sentry/utils/fields';

import {useParameterSuggestions} from './parametersCombobox';
import {getAggregateArgTexts, getConditionalAggregateArgumentLabel} from './utils';

type ConditionalAggregateParametersProps = {
  definition: FieldDefinition;
  onCommit: () => void;
  onDelete: () => void;
  state: ListState<ParseResultToken>;
  token: AggregateFilter;
};

/**
 * Edits the arguments of an `_if` aggregate with one input per argument, like the
 * equation builder: a search input for the filter, then the base aggregate's
 * arguments.
 */
export function SearchQueryBuilderConditionalAggregateParameters({
  definition,
  state,
  token,
  onCommit,
  onDelete,
}: ConditionalAggregateParametersProps) {
  const {dispatch} = useSearchQueryBuilderState();
  const {filterKeys, getSuggestedFilterKey} = useSearchQueryBuilderConfig();
  const parameters = useMemo(() => definition.parameters ?? [], [definition]);

  const groupRef = useRef<HTMLSpanElement>(null);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const committedRef = useRef(false);

  const [args, setArgs] = useState(() => {
    const argTexts = getAggregateArgTexts(token);
    return parameters.map((parameter, i) => {
      const text = argTexts[i] ?? '';
      return isSearchFilterParameter(parameter) ? unwrapSearchFilterArgument(text) : text;
    });
  });
  // Commit reads the latest arguments in the same event that changed them.
  const argsRef = useRef(args);

  const setArgumentAtIndex = useCallback((index: number, value: string) => {
    const next = argsRef.current.map((arg, i) => (i === index ? value : arg));
    argsRef.current = next;
    setArgs(next);
  }, []);

  const commit = useCallback(
    ({focusValue}: {focusValue: boolean}) => {
      if (committedRef.current) {
        return;
      }
      committedRef.current = true;

      const values = parameters.map((parameter, i) => {
        const arg = argsRef.current[i]?.trim() ?? '';
        if (isSearchFilterParameter(parameter)) {
          return ensureSearchFilterArgument(arg);
        }
        if (parameter.kind === 'column') {
          return resolveFilterKey({key: arg, filterKeys, getSuggestedFilterKey});
        }
        return arg;
      });
      // Leave out trailing optional arguments that were cleared.
      while (values.length > 1 && !values[values.length - 1]) {
        values.pop();
      }

      const value = values.join(',');
      if (value !== (token.key.args?.text ?? '')) {
        dispatch({
          type: 'UPDATE_AGGREGATE_ARGS',
          token,
          value,
          focusOverride:
            focusValue && state.selectionManager.focusedKey
              ? {itemKey: `${state.selectionManager.focusedKey}`, part: 'value'}
              : undefined,
        });
      }
      onCommit();
    },
    [dispatch, filterKeys, getSuggestedFilterKey, onCommit, parameters, state, token]
  );

  const focusArgument = useCallback((index: number) => {
    const input = inputRefs.current[index];
    if (input) {
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }
  }, []);

  const goToNextArgumentOrCommit = useCallback(
    (index: number) => {
      if (index + 1 < parameters.length) {
        focusArgument(index + 1);
      } else {
        commit({focusValue: true});
      }
    },
    [commit, focusArgument, parameters.length]
  );

  const shouldCloseOnInteractOutside = useCallback(
    (el: Element) => !groupRef.current?.contains(el),
    []
  );

  const onArgumentKeyDown = useCallback(
    (index: number, e: KeyboardEvent) => {
      const input = e.target as HTMLInputElement;
      const atStart = input.selectionStart === 0 && input.selectionEnd === 0;
      const atEnd =
        input.selectionStart === input.value.length &&
        input.selectionEnd === input.value.length;

      if (e.key === 'Backspace' && atStart) {
        if (index === 0) {
          committedRef.current = true;
          onDelete();
        } else {
          focusArgument(index - 1);
        }
        return;
      }
      if (e.key === 'ArrowLeft' && atStart && index > 0) {
        focusArgument(index - 1);
        return;
      }
      if (e.key === 'ArrowRight' && atEnd && index + 1 < parameters.length) {
        focusArgument(index + 1);
      }
    },
    [focusArgument, onDelete, parameters.length]
  );

  return (
    <Flex as="span" align="center" height="100%" minWidth="0" ref={groupRef}>
      {parameters.map((parameter, i) => {
        const argumentProps: ArgumentInputProps = {
          autoFocus: i === 0,
          inputRef: el => {
            inputRefs.current[i] = el;
          },
          onBlurOutside: () => commit({focusValue: false}),
          onChange: value => setArgumentAtIndex(i, value),
          onExit: () => commit({focusValue: false}),
          onKeyDown: e => onArgumentKeyDown(i, e),
          onNext: () => goToNextArgumentOrCommit(i),
          parameter,
          shouldCloseOnInteractOutside,
          token,
          value: args[i] ?? '',
        };
        return (
          <Fragment key={i}>
            {i > 0 && <Separator>{','}</Separator>}
            {isSearchFilterParameter(parameter) ? (
              <FilterArgumentInput {...argumentProps} />
            ) : (
              <ValueArgumentInput {...argumentProps} />
            )}
          </Fragment>
        );
      })}
    </Flex>
  );
}

type ArgumentInputProps = {
  autoFocus: boolean;
  inputRef: (el: HTMLInputElement | null) => void;
  onBlurOutside: () => void;
  onChange: (value: string) => void;
  onExit: () => void;
  onKeyDown: (e: KeyboardEvent) => void;
  /** Move to the next argument, or commit after the last one. */
  onNext: () => void;
  parameter: AggregateParameter;
  shouldCloseOnInteractOutside: (el: Element) => boolean;
  token: AggregateFilter;
  value: string;
};

/**
 * Search filter argument. Suggests attribute keys, then values for the key under the
 * cursor, using the same autocomplete as the equation builder.
 */
function FilterArgumentInput({
  autoFocus,
  inputRef,
  onBlurOutside,
  onChange,
  onExit,
  onKeyDown,
  onNext,
  shouldCloseOnInteractOutside,
  token,
  value,
}: ArgumentInputProps) {
  const {filterKeys, getFieldDefinition, getTagValues} = useSearchQueryBuilderConfig();
  const localInputRef = useRef<HTMLInputElement | null>(null);
  const pendingCaretRef = useRef<number | null>(null);
  const [selectionIndex, setSelectionIndex] = useState(value.length);

  const filterKeyArguments = useMemo<FunctionArgument[]>(
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

  const {comboBoxFilterValue, editPhase, items, parsedFilterInput} =
    useConditionalFilterAutocomplete({
      enabled: true,
      filterValue: value,
      functionArguments: filterKeyArguments,
      getFilterTagValues: getTagValues,
      selectionIndex,
    });

  // Move the caret after React commits a value picked from the menu.
  useLayoutEffect(() => {
    const pos = pendingCaretRef.current;
    const input = localInputRef.current;
    if (pos === null || !input) {
      return;
    }
    pendingCaretRef.current = null;
    input.setSelectionRange(pos, pos);
    // oxlint-disable-next-line react/exhaustive-effect-dependencies
  }, [value]);

  const updateSelectionIndex = useCallback(() => {
    setSelectionIndex(localInputRef.current?.selectionStart ?? 0);
  }, []);

  const onOptionSelected = useCallback(
    (option: SelectOptionWithKey<string>) => {
      const {newValue, newCursorIndex} = replaceConditionalFilterClause(
        value,
        selectionIndex,
        option.value
      );
      pendingCaretRef.current = newCursorIndex;
      setSelectionIndex(newCursorIndex);
      onChange(newValue);
    },
    [onChange, selectionIndex, value]
  );

  return (
    <Flex as="span" height="100%" minWidth="0">
      <SearchQueryBuilderCombobox
        ref={el => {
          localInputRef.current = el;
          inputRef(el);
        }}
        autoFocus={autoFocus}
        openOnFocus
        items={items}
        inputValue={value}
        filterValue={comboBoxFilterValue}
        shouldFilterResults={!(editPhase === 'value' && parsedFilterInput)}
        keepMenuOpenOnSelect={option => isFilterKeySuggestion(option.value)}
        inputLabel={t('Add a filter')}
        token={token}
        maxOptions={20}
        shouldCloseOnInteractOutside={shouldCloseOnInteractOutside}
        onInputChange={e => {
          onChange(e.target.value);
          setSelectionIndex(e.target.selectionStart ?? 0);
        }}
        onKeyDown={onKeyDown}
        onKeyUp={updateSelectionIndex}
        onClick={updateSelectionIndex}
        onOptionSelected={onOptionSelected}
        onCustomValueCommitted={onNext}
        onCustomValueBlurred={onBlurOutside}
        onExit={onExit}
      >
        {item =>
          itemIsSection(item) ? (
            <Section title={item.label} key={item.key}>
              {item.options.map(child => (
                <Item {...child} key={child.key}>
                  {child.label}
                </Item>
              ))}
            </Section>
          ) : (
            <Item {...item} key={item.key}>
              {item.label}
            </Item>
          )
        }
      </SearchQueryBuilderCombobox>
    </Flex>
  );
}

/**
 * Column or value argument. Shows the current argument as the placeholder, and
 * typing filters the suggestions, like the equation builder.
 */
function ValueArgumentInput({
  autoFocus,
  inputRef,
  onBlurOutside,
  onChange,
  onExit,
  onKeyDown,
  onNext,
  parameter,
  shouldCloseOnInteractOutside,
  token,
  value,
}: ArgumentInputProps) {
  const [inputValue, setInputValue] = useState('');
  const suggestions = useParameterSuggestions({parameterDefinition: parameter});

  const items = useMemo(
    () =>
      suggestions.map(item => {
        const label = getConditionalAggregateArgumentLabel(parameter, item.value);
        return label === item.value ? item : {...item, label, textValue: label};
      }),
    [parameter, suggestions]
  );

  const applyInputValue = () => {
    const typed = inputValue.trim();
    if (!typed) {
      return;
    }
    // Typing the default label (`spans`) selects its column.
    onChange(
      parameter.kind === 'column' &&
        parameter.defaultLabel === typed &&
        parameter.defaultValue
        ? parameter.defaultValue
        : typed
    );
    setInputValue('');
  };

  return (
    <Flex as="span" height="100%" minWidth="0">
      <SearchQueryBuilderCombobox
        ref={inputRef}
        autoFocus={autoFocus}
        openOnFocus
        items={items}
        inputValue={inputValue}
        placeholder={getConditionalAggregateArgumentLabel(parameter, value)}
        inputLabel={
          parameter.kind === 'column' ? t('Select an attribute') : t('Select an option')
        }
        token={token}
        maxOptions={20}
        shouldCloseOnInteractOutside={shouldCloseOnInteractOutside}
        onInputChange={e => setInputValue(e.target.value)}
        onKeyDown={onKeyDown}
        onOptionSelected={option => {
          onChange(option.value);
          setInputValue('');
          onNext();
        }}
        onCustomValueCommitted={() => {
          applyInputValue();
          onNext();
        }}
        onCustomValueBlurred={() => {
          applyInputValue();
          onBlurOutside();
        }}
        onExit={onExit}
      >
        {item => (
          <Item {...item} key={item.key}>
            {item.label}
          </Item>
        )}
      </SearchQueryBuilderCombobox>
    </Flex>
  );
}

const Separator = styled('span')`
  color: ${p => p.theme.tokens.content.secondary};
`;
