import type {ChangeEvent, FocusEvent, RefObject} from 'react';
import {useCallback, useMemo, useRef, useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import {type AriaGridListOptions} from '@react-aria/gridlist';
import {Item, Section} from '@react-stately/collections';
import {useListState, type ListState} from '@react-stately/list';
import type {CollectionChildren, KeyboardEvent, Node} from '@react-types/shared';

import {Flex} from '@sentry/scraps/layout';

import {useArithmeticBuilder} from 'sentry/components/arithmeticBuilder/context';
import type {
  Token,
  TokenAttribute,
  TokenFunction,
} from 'sentry/components/arithmeticBuilder/token';
import {TokenKind} from 'sentry/components/arithmeticBuilder/token';
import {nextTokenKeyOfKind} from 'sentry/components/arithmeticBuilder/tokenizer';
import type {FunctionArgument} from 'sentry/components/arithmeticBuilder/types';
import type {SelectOptionWithKey} from 'sentry/components/core/compactSelect/types';
import InteractionStateLayer from 'sentry/components/core/interactionStateLayer';
import {itemIsSection} from 'sentry/components/searchQueryBuilder/tokens/utils';
import {useGridList} from 'sentry/components/tokenizedInput/grid/useGridList';
import {useGridListItem} from 'sentry/components/tokenizedInput/grid/useGridListItem';
import {focusTarget} from 'sentry/components/tokenizedInput/grid/utils';
import {ComboBox} from 'sentry/components/tokenizedInput/token/comboBox';
import {InputBox} from 'sentry/components/tokenizedInput/token/inputBox';
import {IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';
import {FieldKind, FieldValueType, prettifyTagKey} from 'sentry/utils/fields';

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
  const {rowProps, gridCellProps} = useGridListItem({
    item,
    ref,
    state,
    focusable: defined(functionArguments) && functionArguments.length > 0, // if there are no arguments, it's not focusable
  });

  const isFocused = item.key === state.selectionManager.focusedKey;

  const attrText = functionArguments.map(arg => arg.attribute).join(',');

  return (
    <FunctionWrapper
      {...rowProps}
      ref={ref}
      tabIndex={isFocused ? 0 : -1}
      aria-label={`${token.function}(${attrText ?? ''})`}
      aria-invalid={false}
      state="valid"
    >
      <FunctionGridCell {...gridCellProps}>{token.function}</FunctionGridCell>
      <ArgumentsGrid rowRef={ref} item={item} state={state} token={token} />
      <BaseGridCell {...gridCellProps}>
        <DeleteFunction token={token} />
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
  const [args, setArguments] = useState<Argument[]>(
    functionToken.attributes.map(attr => {
      return {
        label: attr.attribute,
        value: attr.text,
      };
    })
  );

  const updateArgumentAtIndex = (index: number, argument: string) => {
    setArguments(prev =>
      prev.map((item, i) =>
        index === i ? {...item, value: argument, label: prettifyTagKey(argument)} : item
      )
    );
  };

  if (!args.length) {
    return '()';
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
      onArgumentsChange={(index: number, argument: string) =>
        updateArgumentAtIndex(index, argument)
      }
    >
      {item => <Item key={item.key}>{item.key}</Item>}
    </ArgumentsGridList>
  );
}

interface GridListProps
  extends AriaGridListOptions<TokenAttribute>,
    ArithmeticTokenFunctionProps {
  arguments: Argument[];
  children: CollectionChildren<TokenAttribute>;
  onArgumentsChange: (index: number, argument: string) => void;
  rowRef: RefObject<HTMLDivElement | null>;
}

function ArgumentsGridList({
  item: functionItem,
  state: functionListState,
  token: functionToken,
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
      {[...state.collection].map((item, index) => {
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
  arguments: functionArguments,
  onArgumentsChange,
}: InternalInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const gridCellRef = useRef<HTMLDivElement>(null);
  const {rowProps, gridCellProps} = useGridListItem({
    item: argumentItem,
    ref: inputRef,
    state: argumentsListState,
    focusable: true,
  });

  const isFocused = argumentItem.key === argumentsListState.selectionManager.focusedKey;
  const hasNextArgument = argumentIndex < functionToken.attributes.length - 1;
  const hasPrevArgument = argumentIndex > 0;

  const [inputValue, setInputValue] = useState('');
  const [currentValue, setCurrentValue] = useState(argument.label);
  const [isCurrentlyEditing, setIsCurrentlyEditing] = useState(false);
  const [_selectionIndex, setSelectionIndex] = useState(0); // TODO
  const [_isOpen, setIsOpen] = useState(false); // TODO

  const filterValue = inputValue.trim();
  const displayValue = isCurrentlyEditing ? inputValue : currentValue;

  const updateSelectionIndex = useCallback(() => {
    setSelectionIndex(inputRef.current?.selectionStart ?? 0);
  }, [setSelectionIndex]);

  const resetInputValue = useCallback(() => {
    setInputValue('');
    updateSelectionIndex();
  }, [updateSelectionIndex]);

  const {
    dispatch,
    functionArguments: builderFunctionArguments,
    getFieldDefinition,
    getSuggestedKey,
  } = useArithmeticBuilder();

  const parameterDefinition = useMemo(
    () => getFieldDefinition(functionToken.function)?.parameters?.[argumentIndex],
    [argumentIndex, getFieldDefinition, functionToken]
  );

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
    if (parameterDefinition && parameterDefinition.kind === 'column') {
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

  const attributeItems = useAttributeItems({
    allowedAttributes,
    filterValue,
  });

  const items = useMemo(() => {
    // If this is a dropdown parameter, use the predefined options
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

    // Otherwise, use the attribute-based items
    return attributeItems;
  }, [parameterDefinition, filterValue, attributeItems]);

  const shouldCloseOnInteractOutside = useCallback((el: Element) => {
    return !gridCellRef.current?.contains(el);
  }, []);

  const onClick = useCallback(() => {
    updateSelectionIndex();
  }, [updateSelectionIndex]);

  const onInputBlur = useCallback(() => {
    resetInputValue();
    setIsCurrentlyEditing(false);
  }, [resetInputValue]);

  const onTextInputBlur = useCallback(() => {
    if (inputValue) {
      onArgumentsChange(argumentIndex, inputValue);
      dispatch({
        text: `${functionToken.function}(${updateAttrsWith(inputValue)})`,
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
    setIsCurrentlyEditing(false);
  }, [
    argumentIndex,
    dispatch,
    functionListState,
    functionToken,
    inputValue,
    onArgumentsChange,
    resetInputValue,
    updateAttrsWith,
  ]);

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

    if (
      defined(getSuggestedKey) &&
      parameterDefinition &&
      parameterDefinition.kind === 'column'
    ) {
      value = getSuggestedKey(value) ?? value;
    }

    setCurrentValue(value);
    onArgumentsChange(argumentIndex, value);

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
      // Check if there's a next argument to focus on
      setCurrentValue(prettifyTagKey(option.value));
      if (hasNextArgument) {
        focusTarget(
          argumentsListState,
          argumentsListState.collection.getKeyAfter(argumentItem.key)
        );
        onArgumentsChange(argumentIndex, option.value);
      } else {
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
      hasNextArgument,
      resetInputValue,
      argumentsListState,
      argumentItem.key,
      onArgumentsChange,
      argumentIndex,
      dispatch,
      functionToken,
      updateAttrsWith,
      functionListState,
    ]
  );

  const onPaste = useCallback((_evt: React.ClipboardEvent<HTMLInputElement>) => {
    // TODO
  }, []);

  if (
    parameterDefinition?.kind === 'value' &&
    (!defined(parameterDefinition.options) || !parameterDefinition.options.length)
  ) {
    return (
      <ArgumentGridCell {...rowProps} {...gridCellProps} tabIndex={-1} ref={gridCellRef}>
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
          onInputFocus={onInputFocus}
          onKeyDown={onKeyDown}
          onKeyDownCapture={onKeyDownCapture}
        />
        {argumentIndex < functionToken.attributes.length - 1 && ','}
      </ArgumentGridCell>
    );
  }

  return (
    <ArgumentGridCell
      {...rowProps}
      {...gridCellProps}
      tabIndex={isFocused ? 0 : -1}
      ref={gridCellRef}
    >
      <ComboBox
        items={items}
        ref={inputRef}
        placeholder={
          parameterDefinition?.kind === 'value' && 'placeholder' in parameterDefinition
            ? (argument.label ?? parameterDefinition.placeholder)
            : argument.label
        }
        inputLabel={
          parameterDefinition?.kind === 'column'
            ? t('Select an attribute')
            : t('Select an option')
        }
        inputValue={displayValue}
        filterValue={filterValue}
        tabIndex={
          argumentItem.key === argumentsListState.selectionManager.focusedKey ? 0 : -1
        }
        shouldCloseOnInteractOutside={shouldCloseOnInteractOutside}
        onClick={onClick}
        onInputBlur={onInputBlur}
        onInputChange={onInputChange}
        onInputCommit={onInputCommit}
        onInputEscape={onInputEscape}
        onInputFocus={onInputFocus}
        onKeyDown={onKeyDown}
        onKeyDownCapture={onKeyDownCapture}
        onOpenChange={setIsOpen}
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
  );
}

interface DeleteFunctionProps {
  token: TokenFunction;
}

function DeleteFunction({token}: DeleteFunctionProps) {
  const {dispatch} = useArithmeticBuilder();

  const onClick = useCallback(() => {
    dispatch({
      type: 'DELETE_TOKEN',
      token,
    });
  }, [dispatch, token]);

  return (
    <DeleteButton aria-label={t('Remove function %s', token.text)} onClick={onClick}>
      <InteractionStateLayer />
      <IconClose legacySize="8px" />
    </DeleteButton>
  );
}

function useAttributeItems({
  allowedAttributes,
  filterValue,
}: {
  allowedAttributes: FunctionArgument[];
  filterValue: string;
}): Array<SelectOptionWithKey<string>> {
  // TODO: use a config
  const attributes: Array<SelectOptionWithKey<string>> = useMemo(() => {
    const items = filterValue
      ? allowedAttributes.filter(attr => attr.name.includes(filterValue))
      : allowedAttributes;

    return items.map(item => ({
      key: item.name,
      label: item.label ?? item.name,
      value: item.name,
      textValue: item.name,
      hideCheck: true,
    }));
  }, [allowedAttributes, filterValue]);

  return attributes;
}

const FunctionWrapper = styled('div')<{state: 'invalid' | 'warning' | 'valid'}>`
  display: flex;
  align-items: flex-start;
  position: relative;
  border: 1px solid ${p => p.theme.tokens.border.secondary};
  border-radius: ${p => p.theme.radius.md};
  height: fit-content;
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

const ArgumentGridCell = styled('div')`
  display: flex;
  align-items: center;
  position: relative;
  height: 100%;
  flex: 0 1 auto;
  max-width: fit-content;

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
`;

const FunctionGridCell = styled(BaseGridCell)`
  color: ${p => p.theme.colors.green500};
  padding-left: ${p => p.theme.space.xs};
`;

const DeleteButton = styled('button')`
  background: none;
  border: none;
  color: ${p => p.theme.tokens.content.secondary};
  outline: none;
  user-select: none;
  padding-right: ${p => p.theme.space.xs};

  :focus {
    background-color: ${p => p.theme.colors.gray100};
    border-left: 1px solid ${p => p.theme.tokens.border.secondary};
    outline: none;
  }
`;
