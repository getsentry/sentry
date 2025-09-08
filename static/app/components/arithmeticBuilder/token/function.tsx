import type {ChangeEvent, FocusEvent, RefObject} from 'react';
import {Fragment, useCallback, useMemo, useRef, useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import {type AriaGridListOptions} from '@react-aria/gridlist';
import {Item, Section} from '@react-stately/collections';
import {useListState, type ListState} from '@react-stately/list';
import type {CollectionChildren, KeyboardEvent, Node} from '@react-types/shared';

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
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import {FieldKind, FieldValueType} from 'sentry/utils/fields';

interface ArithmeticTokenFunctionProps {
  item: Node<Token>;
  state: ListState<Token>;
  token: TokenFunction;
}

// setInterval(() => {
//   console.log(document.activeElement);
// }, 1000);

export function ArithmeticTokenFunction({
  item,
  state,
  token,
}: ArithmeticTokenFunctionProps) {
  const attributes = token.attributes;

  const ref = useRef<HTMLDivElement>(null);
  const {rowProps, gridCellProps} = useGridListItem({
    item,
    ref,
    state,
    focusable: defined(attributes) && attributes.length > 0, // if there are no attributes, it's not focusable
  });

  const isFocused = item.key === state.selectionManager.focusedKey;

  let attrText = '';

  attributes.forEach((attribute, index) => {
    if (index === attributes.length - 1) {
      attrText += `${attribute.text}`;
    } else {
      attrText += `${attribute.text},`;
    }
  });

  return (
    <FunctionWrapper
      {...rowProps}
      ref={ref}
      tabIndex={isFocused ? 0 : -1}
      aria-label={`${token.function}(${attrText ?? ''})`}
      aria-invalid={false}
      state={'valid'}
    >
      <FunctionGridCell {...gridCellProps}>{token.function}</FunctionGridCell>
      {'('}
      {/* {attributes && <Arguments item={item} state={state} token={token} rowRef={ref} />} */}
      <ArgumentsGrid rowRef={ref} item={item} state={state} token={token} />
      {')'}
      <BaseGridCell {...gridCellProps}>
        <DeleteFunction token={token} />
      </BaseGridCell>
    </FunctionWrapper>
  );
}

interface ArgumentsGridProps extends ArithmeticTokenFunctionProps {
  rowRef: RefObject<HTMLDivElement | null>;
}

function ArgumentsGrid({
  item: functionItem,
  state: functionListState,
  token: functionToken,
  rowRef,
}: ArgumentsGridProps) {
  const attributes = functionToken.attributes;

  return (
    <Fragment>
      {attributes && (
        <ArgumentsGridList
          items={attributes}
          rowRef={rowRef}
          item={functionItem}
          state={functionListState}
          token={functionToken}
        >
          {item => <Item key={item.key}>{item.key}</Item>}
        </ArgumentsGridList>
      )}
    </Fragment>
  );
}

interface GridListProps
  extends AriaGridListOptions<TokenAttribute>,
    ArithmeticTokenFunctionProps {
  children: CollectionChildren<TokenAttribute>;
  rowRef: RefObject<HTMLDivElement | null>;
}

function ArgumentsGridList({
  item: functionItem,
  state: functionListState,
  token: functionToken,
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
    <AttributesWrapper {...gridProps} ref={ref}>
      {[...state.collection].map((item, index) => {
        const attribute = item.value;

        if (!defined(attribute)) {
          return null;
        }
        return (
          <BaseGridCell key={attribute.attribute}>
            <InternalInput
              argumentItem={item}
              argumentListState={state}
              functionItem={functionItem}
              functionListState={functionListState}
              functionToken={functionToken}
              attribute={attribute}
              rowRef={rowRef}
              argumentRef={ref}
              argumentIndex={index}
            />
          </BaseGridCell>
        );
      })}
    </AttributesWrapper>
  );
}

interface InternalInputProps {
  argumentIndex: number;
  argumentItem: Node<Token>;
  argumentListState: ListState<TokenAttribute>;
  argumentRef: RefObject<HTMLDivElement | null>;
  attribute: TokenAttribute;
  functionItem: Node<Token>;
  functionListState: ListState<Token>;
  functionToken: TokenFunction;
  rowRef: RefObject<HTMLDivElement | null>;
}

function InternalInput({
  argumentIndex,
  functionToken,
  functionItem,
  functionListState,
  argumentListState,
  argumentItem,
  attribute,
  argumentRef,
}: InternalInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const gridCellRef = useRef<HTMLDivElement>(null);
  const {rowProps, gridCellProps} = useGridListItem({
    item: argumentItem,
    ref: inputRef,
    state: argumentListState,
    focusable: true, // if there are no attributes, it's not focusable
  });

  const isFocused = argumentItem.key === argumentListState.selectionManager.focusedKey;

  const [inputValue, setInputValue] = useState('');
  const [currentValue, setCurrentValue] = useState(attribute.attribute);
  const [isCurrentlyEditing, setIsCurrentlyEditing] = useState(false);
  const [_selectionIndex, setSelectionIndex] = useState(0); // TODO
  const [_isOpen, setIsOpen] = useState(false); // TODO

  const hasNextAttribute = argumentIndex < functionToken.attributes.length - 1;
  const hasPrevAttribute = argumentIndex > 0;

  const filterValue = inputValue.trim();
  const displayValue = isCurrentlyEditing ? inputValue : currentValue;

  const updateSelectionIndex = useCallback(() => {
    setSelectionIndex(inputRef.current?.selectionStart ?? 0);
  }, [setSelectionIndex]);

  const resetInputValue = useCallback(() => {
    setInputValue('');
    updateSelectionIndex();
  }, [updateSelectionIndex]);

  const {dispatch, functionArguments, getFieldDefinition, getSuggestedKey} =
    useArithmeticBuilder();

  const parameterDefinition = useMemo(
    () => getFieldDefinition(functionToken.function)?.parameters?.[argumentIndex],
    [argumentIndex, getFieldDefinition, functionToken]
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
    return functionArguments.filter(functionArgument => {
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
  }, [attributesFilter, functionArguments, getFieldDefinition]);

  const attributeItems = useAttributeItems({
    allowedAttributes,
    filterValue,
  });

  const items = useMemo(() => {
    // If this is a dropdown parameter, use the predefined options
    if (parameterDefinition?.kind === 'dropdown' && parameterDefinition.options) {
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

  const shouldCloseOnInteractOutside = useCallback(
    (el: Element) => {
      console.log('should close on input blur check', !gridCellRef.current?.contains(el));
      console.log(argumentRef.current);
      console.log(el);
      return !gridCellRef.current?.contains(el);
    },
    [argumentRef]
  );

  const onClick = useCallback(() => {
    console.log('onClick');
    updateSelectionIndex();
  }, [updateSelectionIndex]);

  const onInputBlur = useCallback(() => {
    console.log('onInputBlur');
    resetInputValue();
    setIsCurrentlyEditing(false);
  }, [resetInputValue]);

  const onInputChange = useCallback(
    (evt: ChangeEvent<HTMLInputElement>) => {
      console.log('onInputChange');
      setInputValue(evt.target.value);
      setCurrentValue(evt.target.value);
      setSelectionIndex(evt.target.selectionStart ?? 0);
    },
    [setInputValue]
  );

  const onInputCommit = useCallback(() => {
    let value = inputValue.trim() || attribute.attribute;

    if (
      defined(getSuggestedKey) &&
      parameterDefinition &&
      parameterDefinition.kind === 'column'
    ) {
      value = getSuggestedKey(value) ?? value;
    }

    const tokenAttributes = functionToken.attributes.map(attr => attr.attribute);
    tokenAttributes[argumentIndex] = value;
    const attrStr = tokenAttributes.join(',');

    console.log('onInputCommit', `${functionToken.function}(${attrStr})`);

    dispatch({
      text: `${functionToken.function}(${attrStr})`,
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
    setIsCurrentlyEditing(false);
  }, [
    inputValue,
    attribute.attribute,
    getSuggestedKey,
    parameterDefinition,
    functionToken,
    argumentIndex,
    dispatch,
    functionListState,
    resetInputValue,
  ]);

  const onInputEscape = useCallback(() => {
    console.log('onInputEscape');
    resetInputValue();
    setIsCurrentlyEditing(false);
  }, [resetInputValue]);

  const onInputFocus = useCallback(
    (evt: FocusEvent<HTMLInputElement>) => {
      console.log('onInputFocus');
      evt.stopPropagation();
      setIsCurrentlyEditing(true);
      resetInputValue();
    },
    [resetInputValue]
  );

  const onKeyDownCapture = useCallback(
    (evt: React.KeyboardEvent<HTMLInputElement>) => {
      console.log('onKeyDownCapture');
      // At start and pressing left arrow, focus the previous full token
      if (
        evt.currentTarget.selectionStart === 0 &&
        evt.currentTarget.selectionEnd === 0 &&
        evt.key === 'ArrowLeft'
      ) {
        if (hasPrevAttribute) {
          focusTarget(
            argumentListState,
            argumentListState.collection.getKeyBefore(argumentItem.key)
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
        if (hasNextAttribute) {
          focusTarget(
            argumentListState,
            argumentListState.collection.getKeyAfter(argumentItem.key)
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
      hasPrevAttribute,
      argumentListState,
      argumentItem.key,
      functionListState,
      functionItem.key,
      hasNextAttribute,
    ]
  );

  const onKeyDown = useCallback(
    (evt: KeyboardEvent) => {
      console.log('onKeyDown');
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
      const tokenAttributes = functionToken.attributes.map(attr => attr.attribute);
      tokenAttributes[argumentIndex] = option.value;
      const attrStr = tokenAttributes.join(',');

      // Check if there's a next attribute to focus on
      if (hasNextAttribute) {
        setCurrentValue(option.value);
        focusTarget(
          argumentListState,
          argumentListState.collection.getKeyAfter(argumentItem.key)
        );
      } else {
        dispatch({
          text: `${functionToken.function}(${attrStr})`,
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
    },
    [
      functionToken,
      argumentIndex,
      hasNextAttribute,
      resetInputValue,
      argumentListState,
      argumentItem.key,
      dispatch,
      functionListState,
    ]
  );

  const onPaste = useCallback((_evt: React.ClipboardEvent<HTMLInputElement>) => {
    // TODO
  }, []);

  if (parameterDefinition?.kind === 'value') {
    return (
      <BaseGridCell
        {...rowProps}
        {...gridCellProps}
        onFocus={() => {
          inputRef.current?.focus();
        }}
        tabIndex={-1}
        ref={gridCellRef}
      >
        <InputBox
          tabIndex={-1}
          ref={inputRef}
          inputLabel={t('Add a literal')}
          inputValue={displayValue}
          onClick={onClick}
          onInputBlur={onInputBlur}
          onInputChange={onInputChange}
          onInputCommit={onInputCommit}
          onInputEscape={onInputEscape}
          onInputFocus={onInputFocus}
          onKeyDown={onKeyDown}
          onKeyDownCapture={onKeyDownCapture}
        />
        {argumentIndex < functionToken.attributes.length - 1 && ','}
      </BaseGridCell>
    );
  }

  return (
    <BaseGridCell
      {...rowProps}
      {...gridCellProps}
      tabIndex={isFocused ? 0 : -1}
      ref={gridCellRef}
    >
      <ComboBox
        items={items}
        ref={inputRef}
        placeholder={
          parameterDefinition?.kind === 'dropdown' && 'placeholder' in parameterDefinition
            ? (parameterDefinition.placeholder ?? attribute.attribute)
            : attribute.attribute
        }
        inputLabel={t('Select an attribute')}
        inputValue={displayValue}
        filterValue={filterValue}
        tabIndex={
          argumentItem.key === argumentListState.selectionManager.focusedKey ? 0 : -1
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
      {argumentIndex < functionToken.attributes.length - 1 && ','}
    </BaseGridCell>
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

const AttributesWrapper = styled('div')`
  display: flex;
  align-items: center;
  position: relative;
  height: 24px;
  /* Ensures that filters do not grow outside of the container */
  min-width: 0;
`;

const FunctionWrapper = styled('div')<{state: 'invalid' | 'warning' | 'valid'}>`
  display: flex;
  align-items: center;
  position: relative;
  border: 1px solid ${p => p.theme.innerBorder};
  border-radius: ${p => p.theme.borderRadius};
  height: 24px;
  /* Ensures that filters do not grow outside of the container */
  min-width: 0;

  :focus {
    background-color: ${p => p.theme.gray100};
    outline: none;
  }

  ${p =>
    p.state === 'invalid'
      ? css`
          border-color: ${p.theme.red200};
          background-color: ${p.theme.red100};
        `
      : p.state === 'warning'
        ? css`
            border-color: ${p.theme.gray300};
            background-color: ${p.theme.gray100};
          `
        : ''}

  &[aria-selected='true'] {
    background-color: ${p => p.theme.gray100};
  }
`;

const BaseGridCell = styled('div')`
  display: flex;
  align-items: center;
  position: relative;
  height: 100%;
`;

const FunctionGridCell = styled(BaseGridCell)`
  color: ${p => p.theme.green400};
  padding-left: ${space(0.5)};
`;

const UnfocusedOverlay = styled('div')`
  position: absolute;
  pointer-events: none;
`;

const DeleteButton = styled('button')`
  background: none;
  border: none;
  color: ${p => p.theme.subText};
  outline: none;
  user-select: none;
  padding-right: ${space(0.5)};

  :focus {
    background-color: ${p => p.theme.translucentGray100};
    border-left: 1px solid ${p => p.theme.innerBorder};
    outline: none;
  }
`;
