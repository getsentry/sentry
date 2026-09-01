import type {ChangeEvent, FocusEvent, RefObject} from 'react';
import {useCallback, useMemo, useRef, useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import {type AriaGridListOptions} from '@react-aria/gridlist';
import {Item, Section} from '@react-stately/collections';
import {useListState, type ListState} from '@react-stately/list';
import type {CollectionChildren, Node} from '@react-types/shared';

import type {SelectOptionWithKey} from '@sentry/scraps/compactSelect';
import {Flex} from '@sentry/scraps/layout';

import {
  isSearchFilterParameter,
  unwrapSearchFilterArgument,
} from 'sentry/components/arithmeticBuilder/conditionalFilter';
import {useArithmeticBuilder} from 'sentry/components/arithmeticBuilder/context';
import type {
  Token,
  TokenAttribute,
  TokenFunction,
} from 'sentry/components/arithmeticBuilder/token';
import {ConditionalFilterArgumentInput} from 'sentry/components/arithmeticBuilder/token/conditionalFilterInput';
import {DeleteButton} from 'sentry/components/arithmeticBuilder/token/deleteButton';
import {
  ArgumentGridCell,
  ArgumentGridRow,
  useFunctionArgumentInput,
  type FunctionArgumentInputProps,
} from 'sentry/components/arithmeticBuilder/token/useFunctionArgumentInput';
import type {FunctionArgument} from 'sentry/components/arithmeticBuilder/types';
import {itemIsSection} from 'sentry/components/searchQueryBuilder/tokens/utils';
import {useGridList} from 'sentry/components/tokenizedInput/grid/useGridList';
import {useGridListItem} from 'sentry/components/tokenizedInput/grid/useGridListItem';
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
      {/* Function tokens are keyed by position (`func:0`), so deleting an earlier
          function reuses this component for the next one. Remount the arguments
          grid when the token identity changes so we don't keep the previous
          function's draft argument state. */}
      <ArgumentsGrid
        key={`${token.location.start.offset}:${token.function}`}
        rowRef={ref}
        item={item}
        state={state}
        token={token}
      />
      <BaseGridCell {...gridCellProps}>
        <DeleteButton token={token} label={t('Remove function %s', token.text)} />
      </BaseGridCell>
    </FunctionWrapper>
  );
}

type Argument = FunctionArgumentInputProps['argument'];

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

function InternalInput(props: FunctionArgumentInputProps) {
  const {getFieldDefinition} = useArithmeticBuilder();
  const parameterDefinition = useMemo(
    () =>
      getFieldDefinition(
        props.functionToken.function,
        props.functionToken.attributes.map(attr => attr.text)
      )?.parameters?.[props.argumentIndex],
    [getFieldDefinition, props.argumentIndex, props.functionToken]
  );

  if (isSearchFilterParameter(parameterDefinition)) {
    return <ConditionalFilterArgumentInput {...props} />;
  }

  return <FunctionArgumentInput {...props} />;
}

function FunctionArgumentInput(props: FunctionArgumentInputProps) {
  const {argument, argumentIndex, functionToken, onArgumentsChange} = props;
  const {
    clearSkipBlurFlush,
    commitFunctionToken,
    dataTestId,
    flushArgumentsIfLeavingGrid,
    focusArgument,
    focusNextArgument,
    gridCellProps,
    gridCellRef,
    hasNextArgument,
    inputRef,
    isFocused,
    onKeyDown,
    onKeyDownCapture,
    rowProps,
    shouldCloseOnInteractOutside,
  } = useFunctionArgumentInput(props);

  const {
    functionArguments: builderFunctionArguments,
    getFieldDefinition,
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
  const displayValue = isCurrentlyEditing ? inputValue : currentValue;

  const resetInputValue = useCallback(() => {
    setInputValue('');
  }, []);

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
  }, [attributeItems, inputValue, parameterDefinition]);

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

  const onInputChange = useCallback((evt: ChangeEvent<HTMLInputElement>) => {
    setInputValue(evt.target.value);
    setCurrentValue(evt.target.value);
  }, []);

  const onInputCommit = useCallback(() => {
    let value = inputValue.trim() || argument.label;

    if (defined(getSuggestedKey) && parameterDefinition?.kind === 'column') {
      value = getSuggestedKey(value) ?? value;
    }

    value = resolveValue(value);

    setCurrentValue(resolveDisplayLabel(value));
    onArgumentsChange(argumentIndex, value);
    commitFunctionToken(value);
    resetInputValue();
  }, [
    argument.label,
    argumentIndex,
    commitFunctionToken,
    getSuggestedKey,
    inputValue,
    onArgumentsChange,
    parameterDefinition,
    resetInputValue,
    resolveDisplayLabel,
    resolveValue,
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
      clearSkipBlurFlush();
      // Explicitly focus target on this item because we're calling evt.stopPropagation().
      // If this isn't called, the argument collection doesn't shift focus to current arg
      // causing bugs. Test for this behaviour can be found in
      // static/app/components/arithmeticBuilder/token/index.spec.tsx -t 'shifts focus between args correctly'
      focusArgument();
      setIsCurrentlyEditing(true);
      resetInputValue();
    },
    [clearSkipBlurFlush, focusArgument, resetInputValue]
  );

  // Free-text value args should keep their current text on focus so the user can edit it.
  // ComboBox clears on focus to type a new query.
  const onTextInputFocus = useCallback(
    (evt: FocusEvent<HTMLInputElement>) => {
      evt.stopPropagation();
      clearSkipBlurFlush();
      focusArgument();
      setIsCurrentlyEditing(true);
      setInputValue(currentValue);
    },
    [clearSkipBlurFlush, currentValue, focusArgument]
  );

  const onOptionSelected = useCallback(
    (option: SelectOptionWithKey<string>) => {
      setCurrentValue(resolveDisplayLabel(prettifyTagKey(option.value)));
      onArgumentsChange(argumentIndex, option.value);
      if (hasNextArgument) {
        focusNextArgument();
      } else {
        commitFunctionToken(option.value);
      }
      resetInputValue();
    },
    [
      argumentIndex,
      commitFunctionToken,
      focusNextArgument,
      hasNextArgument,
      onArgumentsChange,
      resetInputValue,
      resolveDisplayLabel,
    ]
  );

  // Free-text value args with no options (e.g. apdex threshold) use a plain input.
  if (
    parameterDefinition?.kind === 'value' &&
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
            parameterDefinition?.kind === 'value' && 'placeholder' in parameterDefinition
              ? (argument.label ?? parameterDefinition.placeholder)
              : resolveDisplayLabel(argument.label)
          }
          inputLabel={
            parameterDefinition?.kind === 'column'
              ? t('Select an attribute')
              : t('Select an option')
          }
          inputValue={displayValue}
          filterValue={inputValue}
          tabIndex={isFocused ? 0 : -1}
          shouldCloseOnInteractOutside={shouldCloseOnInteractOutside}
          onInputBlur={onInputBlur}
          onInputChange={onInputChange}
          onInputCommit={onInputCommit}
          onInputEscape={onInputEscape}
          onInputFocus={onInputFocus}
          onKeyDown={onKeyDown}
          onKeyDownCapture={onKeyDownCapture}
          onOptionSelected={onOptionSelected}
          data-test-id={dataTestId}
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
