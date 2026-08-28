import type {ChangeEvent, FocusEvent, MouseEvent, RefObject} from 'react';
import {useCallback, useMemo, useRef, useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import {type AriaGridListOptions} from '@react-aria/gridlist';
import {Item, Section} from '@react-stately/collections';
import {useListState, type ListState} from '@react-stately/list';
import type {CollectionChildren, KeyboardEvent, Node} from '@react-types/shared';

import type {SelectOptionWithKey} from '@sentry/scraps/compactSelect';
import {Flex} from '@sentry/scraps/layout';

import {
  ensureSearchFilterArgument,
  isFilterKeySuggestion,
  isSearchFilterParameter,
  replaceConditionalFilterClause,
  unwrapSearchFilterArgument,
} from 'sentry/components/arithmeticBuilder/conditionalFilter';
import {useConditionalFilterAutocomplete} from 'sentry/components/arithmeticBuilder/conditionalFilterAutocomplete';
import {useArithmeticBuilder} from 'sentry/components/arithmeticBuilder/context';
import type {
  Token,
  TokenAttribute,
  TokenFunction,
} from 'sentry/components/arithmeticBuilder/token';
import {TokenKind} from 'sentry/components/arithmeticBuilder/token';
import {DeleteButton} from 'sentry/components/arithmeticBuilder/token/deleteButton';
import {nextTokenKeyOfKind} from 'sentry/components/arithmeticBuilder/tokenizer';
import type {FunctionArgument} from 'sentry/components/arithmeticBuilder/types';
import {itemIsSection} from 'sentry/components/searchQueryBuilder/tokens/utils';
import {useGridList} from 'sentry/components/tokenizedInput/grid/useGridList';
import {useGridListItem} from 'sentry/components/tokenizedInput/grid/useGridListItem';
import {focusTarget} from 'sentry/components/tokenizedInput/grid/utils';
import {ComboBox} from 'sentry/components/tokenizedInput/token/comboBox';
import {InputBox} from 'sentry/components/tokenizedInput/token/inputBox';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils/defined';
import {FieldKind, FieldValueType, prettifyTagKey} from 'sentry/utils/fields';

function resolveArgumentDisplayLabel(
  parameterDefinition:
    | {defaultLabel?: string; kind?: string; name?: string}
    | null
    | undefined,
  fallbackLabel: string
): string {
  if (parameterDefinition?.kind === 'column' && parameterDefinition.defaultLabel) {
    return parameterDefinition.defaultLabel;
  }
  if (isSearchFilterParameter(parameterDefinition)) {
    return unwrapSearchFilterArgument(fallbackLabel);
  }
  return fallbackLabel;
}

interface ArithmeticTokenFunctionProps {
  item: Node<Token>;
  state: ListState<Token>;
  token: TokenFunction;
}

export function ArithmeticTokenFunction({
  item,
  state,
  token,
}: ArithmeticTokenFunctionProps) {
  const functionArguments = token.attributes;

  const ref = useRef<HTMLDivElement>(null);
  const skipArgumentFocusRef = useRef(false);
  const {rowProps, gridCellProps} = useGridListItem({
    item,
    ref,
    state,
    focusable: defined(functionArguments) && functionArguments.length > 0, // if there are no arguments, it's not focusable
  });

  const onRowFocus = useCallback(
    (evt: FocusEvent<HTMLDivElement>) => {
      if (skipArgumentFocusRef.current) {
        skipArgumentFocusRef.current = false;
        return;
      }
      rowProps.onFocus?.(evt);
    },
    [rowProps]
  );

  const onFunctionNameMouseDown = useCallback(() => {
    skipArgumentFocusRef.current = true;
  }, []);

  const isFocused = item.key === state.selectionManager.focusedKey;

  const attrText = functionArguments.map(arg => arg.attribute).join(',');

  return (
    <FunctionWrapper
      {...rowProps}
      onFocus={onRowFocus}
      ref={ref}
      tabIndex={isFocused ? 0 : -1}
      aria-label={`${token.function}(${attrText ?? ''})`}
      aria-invalid={false}
      state="valid"
    >
      <FunctionGridCell {...gridCellProps} onMouseDown={onFunctionNameMouseDown}>
        {token.function}
      </FunctionGridCell>
      <ArgumentsGrid rowRef={ref} item={item} state={state} token={token} />
      <BaseGridCell {...gridCellProps}>
        <DeleteButton token={token} label={t('Remove function %s', token.text)} />
      </BaseGridCell>
    </FunctionWrapper>
  );
}

type Argument = {label: string; value: string};

interface ArgumentsGridProps extends ArithmeticTokenFunctionProps {
  rowRef: RefObject<HTMLDivElement | null>;
}

function ArgumentsGrid({
  item: functionItem,
  state: functionListState,
  token: functionToken,
  rowRef,
}: ArgumentsGridProps) {
  const {dispatch, getFieldDefinition} = useArithmeticBuilder();

  const resolveArgumentLabel = useCallback(
    (index: number, fallbackLabel: string) => {
      const fieldDefinition = getFieldDefinition(
        functionToken.function,
        functionToken.attributes.map(attr => attr.text)
      )?.parameters?.[index];
      return resolveArgumentDisplayLabel(fieldDefinition, fallbackLabel);
    },
    [getFieldDefinition, functionToken]
  );

  const [args, setArguments] = useState(
    functionToken.attributes.map((attr, index) => {
      return {
        label: resolveArgumentLabel(index, attr.attribute),
        value: attr.text,
      };
    })
  );

  const argsRef = useRef(args);
  argsRef.current = args;
  const functionTokenRef = useRef(functionToken);
  functionTokenRef.current = functionToken;

  const commitArgumentsIfChanged = useCallback(() => {
    const nextArgs = argsRef.current.map(argument => argument.value).join(',');
    const prevArgs = functionTokenRef.current.attributes
      .map(attribute => attribute.text)
      .join(',');
    if (nextArgs === prevArgs) {
      return;
    }
    dispatch({
      type: 'REPLACE_TOKEN',
      token: functionTokenRef.current,
      text: `${functionTokenRef.current.function}(${nextArgs})`,
    });
  }, [dispatch]);

  const updateArgumentAtIndex = (index: number, argument: string) => {
    setArguments(prev => {
      const next = prev.map((item, i) =>
        index === i
          ? {
              ...item,
              value: argument,
              label: resolveArgumentLabel(index, prettifyTagKey(argument)),
            }
          : item
      );
      argsRef.current = next;
      return next;
    });
  };

  if (!args.length) {
    return <BaseGridCell>()</BaseGridCell>;
  }

  return (
    <ArgumentsGridList
      aria-label={t('Enter arguments')}
      items={functionToken.attributes}
      arguments={args}
      rowRef={rowRef}
      item={functionItem}
      state={functionListState}
      token={functionToken}
      onArgumentsBlur={commitArgumentsIfChanged}
      onArgumentsChange={(index: number, argument: string) =>
        updateArgumentAtIndex(index, argument)
      }
    >
      {item => <Item key={item.key}>{item.key}</Item>}
    </ArgumentsGridList>
  );
}

interface GridListProps
  extends AriaGridListOptions<TokenAttribute>, ArithmeticTokenFunctionProps {
  arguments: Argument[];
  children: CollectionChildren<TokenAttribute>;
  onArgumentsBlur: () => void;
  onArgumentsChange: (index: number, argument: string) => void;
  rowRef: RefObject<HTMLDivElement | null>;
}

function ArgumentsGridList({
  item: functionItem,
  state: functionListState,
  token: functionToken,
  onArgumentsBlur,
  onArgumentsChange,
  arguments: functionArguments,
  rowRef,
  ...props
}: GridListProps) {
  const ref = useRef<HTMLDivElement>(null);
  const selectionKeyHandlerRef = useRef<HTMLInputElement>(null); // TODO: implement

  const state = useListState<TokenAttribute>({
    ...props,
    selectionBehavior: 'replace',
    onSelectionChange: selection => {
      // When there is a selection, focus the SelectionKeyHandler which will
      // handle keyboard events in this state.
      if (selection === 'all' || selection.size > 0) {
        state.selectionManager.setFocused(true);
        state.selectionManager.setFocusedKey(null);
        selectionKeyHandlerRef.current?.focus();
      }
    },
  });

  const {gridProps} = useGridList({
    props,
    state,
    ref,
  });

  return (
    <Flex
      justify="start"
      wrap="wrap"
      flexGrow={0}
      flexShrink={1}
      height="100%"
      position="relative"
      {...gridProps}
      ref={ref}
    >
      {Array.from(state.collection, (item, index) => {
        const attribute = item.value;

        if (!defined(attribute)) {
          return null;
        }

        const argument = {label: attribute.attribute, value: attribute.text};
        return (
          <BaseGridCell key={`${attribute.key}-${attribute.attribute}`}>
            {index === 0 ? '(' : null}
            <InternalInput
              functionItem={functionItem}
              functionListState={functionListState}
              functionToken={functionToken}
              rowRef={rowRef}
              argument={argument}
              argumentItem={item}
              arguments={functionArguments}
              argumentsListState={state}
              argumentRef={ref}
              argumentIndex={index}
              onArgumentsBlur={onArgumentsBlur}
              onArgumentsChange={onArgumentsChange}
            />
            {index < functionToken.attributes.length - 1 && ','}
            {index === state.collection.size - 1 ? ')' : null}
          </BaseGridCell>
        );
      })}
    </Flex>
  );
}

interface InternalInputProps {
  argument: Argument;
  argumentIndex: number;
  argumentItem: Node<TokenAttribute>;
  argumentRef: RefObject<HTMLDivElement | null>;
  arguments: Argument[];
  argumentsListState: ListState<TokenAttribute>;
  functionItem: Node<Token>;
  functionListState: ListState<Token>;
  functionToken: TokenFunction;
  onArgumentsBlur: () => void;
  onArgumentsChange: (index: number, argument: string) => void;
  rowRef: RefObject<HTMLDivElement | null>;
}

function InternalInput({
  argumentIndex,
  functionToken,
  functionItem,
  functionListState,
  argumentsListState,
  argumentItem,
  argument,
  argumentRef,
  arguments: functionArguments,
  onArgumentsBlur,
  onArgumentsChange,
}: InternalInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const gridCellRef = useRef<HTMLDivElement>(null);
  const {rowProps, gridCellProps} = useGridListItem({
    item: argumentItem,
    ref: gridCellRef,
    state: argumentsListState,
    focusable: true,
  });

  const isFocused = argumentItem.key === argumentsListState.selectionManager.focusedKey;
  const hasNextArgument = argumentIndex < functionToken.attributes.length - 1;
  const hasPrevArgument = argumentIndex > 0;

  const {
    dispatch,
    functionArguments: builderFunctionArguments,
    getFieldDefinition,
    getFilterTagValues,
    getSuggestedKey,
  } = useArithmeticBuilder();

  const parameterDefinition = useMemo(
    () =>
      getFieldDefinition(
        functionToken.function,
        functionToken.attributes.map(attr => attr.text)
      )?.parameters?.[argumentIndex],
    [argumentIndex, getFieldDefinition, functionToken]
  );

  const resolveDisplayLabel = useCallback(
    (fallback: string): string =>
      resolveArgumentDisplayLabel(parameterDefinition, fallback),
    [parameterDefinition]
  );

  const initialLabel = resolveDisplayLabel(argument.label);

  const [inputValue, setInputValue] = useState('');
  const [currentValue, setCurrentValue] = useState(initialLabel);
  const [isCurrentlyEditing, setIsCurrentlyEditing] = useState(false);
  const [selectionIndex, setSelectionIndex] = useState(0);
  const skipBlurFlushRef = useRef(false);

  const isFilterParameter = isSearchFilterParameter(parameterDefinition);

  const displayValue = isCurrentlyEditing ? inputValue : currentValue;

  const {
    comboBoxFilterValue,
    editPhase,
    items: filterItems,
  } = useConditionalFilterAutocomplete({
    enabled: isFilterParameter && isCurrentlyEditing,
    filterValue: inputValue,
    functionArguments: builderFunctionArguments,
    getFilterTagValues,
    selectionIndex,
  });

  const shouldFilterComboBoxResults = !(
    isFilterParameter &&
    editPhase === 'value' &&
    getFilterTagValues
  );

  const updateSelectionIndex = useCallback((input?: HTMLInputElement | null) => {
    const target = input ?? inputRef.current;
    setSelectionIndex(target?.selectionStart ?? 0);
  }, []);

  const resetInputValue = useCallback(() => {
    setInputValue('');
    updateSelectionIndex();
  }, [updateSelectionIndex]);

  const updateAttrsWith = useCallback(
    (value: string) => {
      const tokenArguments = functionArguments.map(arg => arg.value);
      tokenArguments[argumentIndex] = value;
      const argsStr = tokenArguments.join(',');
      return argsStr;
    },
    [argumentIndex, functionArguments]
  );

  const attributesFilter = useMemo(() => {
    if (parameterDefinition?.kind === 'column') {
      const columnTypes = parameterDefinition.columnTypes;
      return typeof columnTypes === 'function'
        ? columnTypes
        : (field: {key: string; valueType: FieldValueType}) =>
            columnTypes.includes(field.valueType);
    }
    return () => false;
  }, [parameterDefinition]);

  const allowedAttributes = useMemo(() => {
    return builderFunctionArguments.filter(functionArgument => {
      const definition = getFieldDefinition(functionArgument.name);
      const defaultType =
        functionArgument.kind === FieldKind.MEASUREMENT
          ? FieldValueType.NUMBER
          : FieldValueType.STRING;
      return (
        definition &&
        attributesFilter({
          key: functionArgument.name,
          valueType: definition?.valueType ?? defaultType,
        })
      );
    });
  }, [attributesFilter, builderFunctionArguments, getFieldDefinition]);

  const attributeItems = useAttributeItems(allowedAttributes);

  const items = useMemo(() => {
    if (isFilterParameter) {
      return filterItems;
    }

    const filterValue = inputValue.trim();

    if (parameterDefinition?.kind === 'value' && parameterDefinition.options) {
      return parameterDefinition.options
        .filter(
          option =>
            !filterValue ||
            option.value.toLowerCase().includes(filterValue.toLowerCase()) ||
            option.label?.toLowerCase().includes(filterValue.toLowerCase())
        )
        .map(option => ({
          key: option.value,
          label: option.label ?? option.value,
          value: option.value,
          textValue: option.value,
          hideCheck: true,
        }));
    }

    // Remap labels (e.g. span.duration → spans for count), then filter
    let result = attributeItems;
    if (
      parameterDefinition?.kind === 'column' &&
      parameterDefinition.defaultLabel &&
      parameterDefinition.defaultValue
    ) {
      result = result.map(item =>
        item.value === parameterDefinition.defaultValue
          ? {
              ...item,
              label: parameterDefinition.defaultLabel,
              textValue: parameterDefinition.defaultLabel,
            }
          : item
      );
    }

    if (filterValue) {
      const lower = filterValue.toLowerCase();
      result = result.filter(
        item =>
          item.value.includes(filterValue) ||
          (item.textValue?.toLowerCase().includes(lower) ?? false)
      );
    }

    return result;
  }, [attributeItems, filterItems, inputValue, isFilterParameter, parameterDefinition]);

  const shouldCloseOnInteractOutside = useCallback((el: Element) => {
    return !gridCellRef.current?.contains(el);
  }, []);

  const onClick = useCallback(
    (evt: MouseEvent<HTMLInputElement>) => {
      const input = evt.currentTarget;
      requestAnimationFrame(() => {
        updateSelectionIndex(input);
      });
    },
    [updateSelectionIndex]
  );

  const onKeyUp = useCallback(() => {
    updateSelectionIndex();
  }, [updateSelectionIndex]);

  const flushArgumentsIfLeavingGrid = useCallback(
    (evt?: FocusEvent<HTMLInputElement>) => {
      if (skipBlurFlushRef.current) {
        skipBlurFlushRef.current = false;
        return;
      }

      if (!evt) {
        window.setTimeout(() => {
          if (skipBlurFlushRef.current) {
            skipBlurFlushRef.current = false;
            return;
          }
          const stayingInArgs = Boolean(
            document.activeElement &&
            argumentRef.current?.contains(document.activeElement)
          );
          if (!stayingInArgs) {
            onArgumentsBlur();
          }
        }, 0);
        return;
      }

      const argsGrid = evt.currentTarget.closest('[role="grid"]');
      const related = evt.relatedTarget;
      const stayingInArgs = Boolean(
        argsGrid && related instanceof Node && argsGrid.contains(related)
      );
      if (!stayingInArgs) {
        onArgumentsBlur();
      }
    },
    [argumentRef, onArgumentsBlur]
  );

  const onInputBlur = useCallback(
    (evt?: FocusEvent<HTMLInputElement>) => {
      resetInputValue();
      setIsCurrentlyEditing(false);
      flushArgumentsIfLeavingGrid(evt);
    },
    [flushArgumentsIfLeavingGrid, resetInputValue]
  );

  const resolveValue = useCallback(
    (raw: string): string => {
      if (isSearchFilterParameter(parameterDefinition)) {
        return ensureSearchFilterArgument(raw);
      }
      if (
        parameterDefinition?.kind === 'column' &&
        parameterDefinition.defaultLabel &&
        parameterDefinition.defaultValue &&
        raw === parameterDefinition.defaultLabel
      ) {
        return parameterDefinition.defaultValue;
      }
      return raw;
    },
    [parameterDefinition]
  );

  // Persist free-text filter edits on blur. Skip REPLACE_TOKEN while focus stays inside
  // the arguments grid — that remounts the function and steals focus from the next arg.
  // Pending edits are flushed via onArgumentsBlur when focus finally leaves the grid.
  const onFilterInputBlur = useCallback(
    (evt?: FocusEvent<HTMLInputElement>) => {
      const value = inputValue ? ensureSearchFilterArgument(inputValue) : null;
      if (value) {
        setCurrentValue(unwrapSearchFilterArgument(value));
        onArgumentsChange(argumentIndex, value);
      }
      resetInputValue();
      setIsCurrentlyEditing(false);
      flushArgumentsIfLeavingGrid(evt);
    },
    [
      argumentIndex,
      flushArgumentsIfLeavingGrid,
      inputValue,
      onArgumentsChange,
      resetInputValue,
    ]
  );

  // Non-filter free-text values (e.g. apdex threshold) flush pending edits when leaving.
  const onTextInputBlur = useCallback(
    (evt: FocusEvent<HTMLInputElement>) => {
      if (inputValue) {
        onArgumentsChange(argumentIndex, inputValue);
      }
      resetInputValue();
      setIsCurrentlyEditing(false);
      flushArgumentsIfLeavingGrid(evt);
    },
    [
      argumentIndex,
      flushArgumentsIfLeavingGrid,
      inputValue,
      onArgumentsChange,
      resetInputValue,
    ]
  );

  const onInputChange = useCallback(
    (evt: ChangeEvent<HTMLInputElement>) => {
      setInputValue(evt.target.value);
      setCurrentValue(evt.target.value);
      setSelectionIndex(evt.target.selectionStart ?? 0);
    },
    [setInputValue]
  );

  const onInputCommit = useCallback(() => {
    let value = inputValue.trim() || argument.label;

    if (defined(getSuggestedKey) && parameterDefinition?.kind === 'column') {
      value = getSuggestedKey(value) ?? value;
    }

    value = resolveValue(value);

    setCurrentValue(resolveDisplayLabel(value));
    onArgumentsChange(argumentIndex, value);
    skipBlurFlushRef.current = true;

    dispatch({
      text: `${functionToken.function}(${updateAttrsWith(value)})`,
      type: 'REPLACE_TOKEN',
      token: functionToken,
      focusOverride: {
        itemKey: nextTokenKeyOfKind(
          functionListState,
          functionToken,
          TokenKind.FREE_TEXT
        ),
      },
    });
    resetInputValue();
  }, [
    inputValue,
    argument.label,
    getSuggestedKey,
    parameterDefinition,
    resolveDisplayLabel,
    resolveValue,
    onArgumentsChange,
    argumentIndex,
    dispatch,
    functionToken,
    updateAttrsWith,
    functionListState,
    resetInputValue,
  ]);

  const onInputEscape = useCallback(() => {
    resetInputValue();
    setIsCurrentlyEditing(false);
  }, [resetInputValue]);

  const onInputFocus = useCallback(
    (evt: FocusEvent<HTMLInputElement>) => {
      // We're stopping propagation because `useGridListItem` in the parent component
      // always steals and sets focus to the first child and we don't want that happening.
      evt.stopPropagation();
      // Explicitly focus target on this item because we're calling evt.stopPropagation().
      // If this isn't called, the argument collection doesn't shift focus to current arg
      // causing bugs. Test for this behaviour can be found in
      // static/app/components/arithmeticBuilder/token/index.spec.tsx -t 'shifts focus between args correctly'
      focusTarget(argumentsListState, argumentItem.key);
      setIsCurrentlyEditing(true);
      resetInputValue();
    },
    [argumentItem.key, argumentsListState, resetInputValue]
  );

  // Free-text value args (e.g. `_if` filters) should keep their current text on focus so
  // the user can edit it. ComboBox clears on focus to type a new filter query.
  const onTextInputFocus = useCallback(
    (evt: FocusEvent<HTMLInputElement>) => {
      evt.stopPropagation();
      focusTarget(argumentsListState, argumentItem.key);
      setIsCurrentlyEditing(true);
      setInputValue(currentValue);
      updateSelectionIndex(evt.currentTarget);
    },
    [argumentItem.key, argumentsListState, currentValue, updateSelectionIndex]
  );

  const onKeyDownCapture = useCallback(
    (evt: React.KeyboardEvent<HTMLInputElement>) => {
      // At start and pressing left arrow, focus the previous full token
      if (
        evt.currentTarget.selectionStart === 0 &&
        evt.currentTarget.selectionEnd === 0 &&
        evt.key === 'ArrowLeft'
      ) {
        if (hasPrevArgument) {
          focusTarget(
            argumentsListState,
            argumentsListState.collection.getKeyBefore(argumentItem.key)
          );
        } else {
          focusTarget(
            functionListState,
            functionListState.collection.getKeyBefore(functionItem.key)
          );
        }
        return;
      }

      // At end and pressing right arrow, focus the next full token
      if (
        evt.currentTarget.selectionStart === evt.currentTarget.value.length &&
        evt.currentTarget.selectionEnd === evt.currentTarget.value.length &&
        evt.key === 'ArrowRight'
      ) {
        if (hasNextArgument) {
          focusTarget(
            argumentsListState,
            argumentsListState.collection.getKeyAfter(argumentItem.key)
          );
        } else {
          focusTarget(
            functionListState,
            functionListState.collection.getKeyAfter(functionItem.key)
          );
        }
        return;
      }
    },
    [
      hasPrevArgument,
      argumentsListState,
      argumentItem.key,
      functionListState,
      functionItem.key,
      hasNextArgument,
    ]
  );

  const onKeyDown = useCallback(
    (evt: KeyboardEvent) => {
      // TODO: handle meta keys

      // At start and pressing backspace, delete this token
      if (
        evt.currentTarget.selectionStart === 0 &&
        evt.currentTarget.selectionEnd === 0 &&
        evt.key === 'Backspace'
      ) {
        const itemKey = functionListState.collection.getKeyBefore(functionItem.key);
        dispatch({
          type: 'DELETE_TOKEN',
          token: functionToken,
          focusOverride: defined(itemKey) ? {itemKey} : undefined,
        });
      }

      // At end and pressing delete, focus the next full token
      if (
        evt.currentTarget.selectionStart === evt.currentTarget.value.length &&
        evt.currentTarget.selectionEnd === evt.currentTarget.value.length &&
        evt.key === 'Delete'
      ) {
        const itemKey = functionListState.collection.getKeyBefore(functionItem.key);
        dispatch({
          type: 'DELETE_TOKEN',
          token: functionToken,
          focusOverride: defined(itemKey) ? {itemKey} : undefined,
        });
      }
    },
    [dispatch, functionToken, functionListState, functionItem]
  );

  const onOptionSelected = useCallback(
    (option: SelectOptionWithKey<string>) => {
      if (isFilterParameter) {
        const {newValue, newCursorIndex} = replaceConditionalFilterClause(
          inputValue,
          selectionIndex,
          option.value
        );
        setCurrentValue(newValue);
        setInputValue(newValue);
        setIsCurrentlyEditing(true);
        setSelectionIndex(newCursorIndex);

        if (isFilterKeySuggestion(option.value)) {
          requestAnimationFrame(() => {
            const input = inputRef.current;
            if (!input) {
              return;
            }
            input.setSelectionRange(newCursorIndex, newCursorIndex);
            input.focus();
          });
        }
        return;
      }

      setCurrentValue(resolveDisplayLabel(prettifyTagKey(option.value)));
      onArgumentsChange(argumentIndex, option.value);
      if (hasNextArgument) {
        focusTarget(
          argumentsListState,
          argumentsListState.collection.getKeyAfter(argumentItem.key)
        );
      } else {
        skipBlurFlushRef.current = true;
        dispatch({
          text: `${functionToken.function}(${updateAttrsWith(option.value)})`,
          type: 'REPLACE_TOKEN',
          token: functionToken,
          focusOverride: {
            itemKey: nextTokenKeyOfKind(
              functionListState,
              functionToken,
              TokenKind.FREE_TEXT
            ),
          },
        });
      }
      resetInputValue();
    },
    [
      isFilterParameter,
      hasNextArgument,
      resolveDisplayLabel,
      resetInputValue,
      argumentsListState,
      argumentItem.key,
      onArgumentsChange,
      argumentIndex,
      dispatch,
      functionToken,
      updateAttrsWith,
      functionListState,
      inputValue,
      selectionIndex,
    ]
  );

  const onPaste = useCallback((_evt: React.ClipboardEvent<HTMLInputElement>) => {
    // TODO
  }, []);

  // Free-text value args with no options (e.g. apdex threshold) use a plain input.
  // `_if` filter args use ComboBox below for attribute-key autocomplete.
  if (
    parameterDefinition?.kind === 'value' &&
    !isFilterParameter &&
    (!defined(parameterDefinition.options) || !parameterDefinition.options.length)
  ) {
    return (
      <ArgumentGridRow {...rowProps} tabIndex={-1} ref={gridCellRef}>
        <ArgumentGridCell {...gridCellProps}>
          <InputBox
            tabIndex={-1}
            ref={inputRef}
            inputLabel={t('Add a value')}
            inputValue={displayValue}
            onClick={onClick}
            onInputBlur={onTextInputBlur}
            onInputChange={onInputChange}
            onInputCommit={onInputCommit}
            onInputEscape={onInputEscape}
            onInputFocus={onTextInputFocus}
            onKeyDown={onKeyDown}
            onKeyDownCapture={onKeyDownCapture}
          />
        </ArgumentGridCell>
      </ArgumentGridRow>
    );
  }

  return (
    <ArgumentGridRow {...rowProps} tabIndex={isFocused ? 0 : -1} ref={gridCellRef}>
      <ArgumentGridCell {...gridCellProps}>
        <ComboBox
          items={items}
          ref={inputRef}
          placeholder={
            isFilterParameter
              ? resolveDisplayLabel(argument.label)
              : parameterDefinition?.kind === 'value' &&
                  'placeholder' in parameterDefinition
                ? (argument.label ?? parameterDefinition.placeholder)
                : resolveDisplayLabel(argument.label)
          }
          inputLabel={
            isFilterParameter
              ? t('Add a filter')
              : parameterDefinition?.kind === 'column'
                ? t('Select an attribute')
                : t('Select an option')
          }
          inputValue={displayValue}
          filterValue={comboBoxFilterValue}
          keepMenuOpenOnSelect={option => isFilterKeySuggestion(option.value)}
          shouldFilterResults={shouldFilterComboBoxResults}
          tabIndex={
            argumentItem.key === argumentsListState.selectionManager.focusedKey ? 0 : -1
          }
          shouldCloseOnInteractOutside={shouldCloseOnInteractOutside}
          onClick={onClick}
          onInputBlur={isFilterParameter ? onFilterInputBlur : onInputBlur}
          onInputChange={onInputChange}
          onInputCommit={onInputCommit}
          onInputEscape={onInputEscape}
          onInputFocus={isFilterParameter ? onTextInputFocus : onInputFocus}
          onKeyDown={onKeyDown}
          onKeyDownCapture={onKeyDownCapture}
          onKeyUp={isFilterParameter ? onKeyUp : undefined}
          onOptionSelected={onOptionSelected}
          onPaste={onPaste}
          data-test-id={
            functionListState.collection.getLastKey() === functionItem.key
              ? 'arithmetic-builder-argument-input'
              : undefined
          }
        >
          {keyItem =>
            itemIsSection(keyItem) ? (
              <Section title={keyItem.label} key={keyItem.key}>
                {keyItem.options.map(child => (
                  <Item {...child} key={child.key}>
                    {child.label}
                  </Item>
                ))}
              </Section>
            ) : (
              <Item {...keyItem} key={keyItem.key}>
                {keyItem.label}
              </Item>
            )
          }
        </ComboBox>
      </ArgumentGridCell>
    </ArgumentGridRow>
  );
}

function useAttributeItems(
  allowedAttributes: FunctionArgument[]
): Array<SelectOptionWithKey<string>> {
  return useMemo(() => {
    return allowedAttributes.map(item => ({
      key: item.name,
      label: item.label ?? item.name,
      value: item.name,
      textValue: item.name,
      hideCheck: true,
    }));
  }, [allowedAttributes]);
}

const FunctionWrapper = styled('div')<{state: 'invalid' | 'warning' | 'valid'}>`
  display: flex;
  align-items: flex-start;
  position: relative;
  border: 1px solid ${p => p.theme.tokens.border.secondary};
  border-radius: ${p => p.theme.radius.md};
  height: fit-content;
  min-height: 24px;
  /* Ensures that filters do not grow outside of the container */
  min-width: 0;
  max-width: 100%;

  :focus {
    background-color: ${p => p.theme.colors.gray100};
    outline: none;
  }

  ${p =>
    p.state === 'invalid'
      ? css`
          border-color: ${p.theme.colors.red200};
          background-color: ${p.theme.colors.red100};
        `
      : p.state === 'warning'
        ? css`
            border-color: ${p.theme.colors.gray400};
            background-color: ${p.theme.colors.gray100};
          `
        : ''}

  &[aria-selected='true'] {
    background-color: ${p => p.theme.colors.gray100};
  }
`;

const ArgumentGridRow = styled('div')`
  display: flex;
  align-items: center;
  position: relative;
  height: 100%;
  flex: 0 1 auto;
  max-width: fit-content;
`;

const ArgumentGridCell = styled('div')`
  display: flex;
  align-items: center;
  height: 100%;

  > div input {
    max-width: 130px !important;
    min-width: 0 !important;
    white-space: nowrap !important;
  }
`;

const BaseGridCell = styled('div')`
  display: flex;
  align-items: center;
  position: relative;
  height: 100%;
  min-height: 22px;
`;

const FunctionGridCell = styled(BaseGridCell)`
  color: ${p => p.theme.colors.green500};
  padding-left: ${p => p.theme.space.xs};
`;
