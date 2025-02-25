import type {ChangeEvent, FocusEvent, RefObject} from 'react';
import {Fragment, useCallback, useMemo, useRef, useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import {Item, Section} from '@react-stately/collections';
import type {ListState} from '@react-stately/list';
import type {KeyboardEvent, Node} from '@react-types/shared';

import {useArithmeticBuilder} from 'sentry/components/arithmeticBuilder/context';
import type {
  Token,
  TokenAttribute,
  TokenFunction,
} from 'sentry/components/arithmeticBuilder/token';
import {TokenKind} from 'sentry/components/arithmeticBuilder/token';
import {nextTokenKeyOfKind} from 'sentry/components/arithmeticBuilder/tokenizer';
import type {FunctionArgument} from 'sentry/components/arithmeticBuilder/types';
import type {SelectOptionWithKey} from 'sentry/components/compactSelect/types';
import InteractionStateLayer from 'sentry/components/interactionStateLayer';
import {itemIsSection} from 'sentry/components/searchQueryBuilder/tokens/utils';
import {useGridListItem} from 'sentry/components/tokenizedInput/grid/useGridListItem';
import {focusTarget} from 'sentry/components/tokenizedInput/grid/utils';
import {ComboBox} from 'sentry/components/tokenizedInput/token/comboBox';
import {IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';

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
  if (token.attributes.length !== 1) {
    throw new Error('Only functions with 1 argument supported.');
  }
  const attribute = token.attributes[0]!;

  const ref = useRef<HTMLDivElement>(null);
  const {rowProps, gridCellProps} = useGridListItem({
    item,
    ref,
    state,
  });

  const isFocused = item.key === state.selectionManager.focusedKey;

  const showUnfocusedState = !state.selectionManager.isFocused || !isFocused;

  return (
    <FunctionWrapper
      {...rowProps}
      ref={ref}
      tabIndex={isFocused ? 0 : -1}
      aria-label={`${token.function}(${attribute.format()})`}
      aria-invalid={false}
      state={'valid'}
    >
      <FunctionGridCell {...gridCellProps}>{token.function}</FunctionGridCell>
      {'('}
      <BaseGridCell {...gridCellProps}>
        <InternalInput
          item={item}
          state={state}
          token={token}
          attribute={attribute}
          rowRef={ref}
        />
        {showUnfocusedState && (
          // Inject a floating span with the attribute name so when it's
          // not focused, it doesn't look like the placeholder text
          <FunctionArgumentOverlay>{attribute.attribute}</FunctionArgumentOverlay>
        )}
      </BaseGridCell>
      {')'}
      <BaseGridCell {...gridCellProps}>
        <DeleteFunction token={token} />
      </BaseGridCell>
    </FunctionWrapper>
  );
}

interface InternalInputProps {
  attribute: TokenAttribute;
  item: Node<Token>;
  rowRef: RefObject<HTMLDivElement>;
  state: ListState<Token>;
  token: TokenFunction;
}

function InternalInput({token, item, state, attribute, rowRef}: InternalInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useState('');
  const [_selectionIndex, setSelectionIndex] = useState(0); // TODO
  const [_isOpen, setIsOpen] = useState(false); // TODO

  const filterValue = inputValue.trim();

  const updateSelectionIndex = useCallback(() => {
    setSelectionIndex(inputRef.current?.selectionStart ?? 0);
  }, [setSelectionIndex]);

  const resetInputValue = useCallback(() => {
    setInputValue('');
    updateSelectionIndex();
  }, [updateSelectionIndex]);

  const {dispatch, functionArguments} = useArithmeticBuilder();

  const items = useAttributeItems({
    allowedAttributes: functionArguments,
    filterValue,
  });

  const shouldCloseOnInteractOutside = useCallback(
    (el: Element) => !rowRef.current?.contains(el),
    [rowRef]
  );

  const onClick = useCallback(() => {
    updateSelectionIndex();
  }, [updateSelectionIndex]);

  const onInputBlur = useCallback(() => {
    resetInputValue();
  }, [resetInputValue]);

  const onInputChange = useCallback(
    (evt: ChangeEvent<HTMLInputElement>) => {
      setInputValue(evt.target.value);
      setSelectionIndex(evt.target.selectionStart ?? 0);
    },
    [setInputValue]
  );

  const onInputCommit = useCallback(() => {
    const value = inputValue.trim() || attribute.attribute;
    dispatch({
      text: `${token.function}(${value})`,
      type: 'REPLACE_TOKEN',
      token,
      focusOverride: {
        itemKey: nextTokenKeyOfKind(state, token, TokenKind.FREE_TEXT),
      },
    });
    resetInputValue();
  }, [dispatch, state, token, attribute, inputValue, resetInputValue]);

  const onInputEscape = useCallback(() => {
    resetInputValue();
  }, [resetInputValue]);

  const onInputFocus = useCallback(
    (_evt: FocusEvent<HTMLInputElement>) => {
      resetInputValue();
    },
    [resetInputValue]
  );

  const onKeyDownCapture = useCallback(
    (evt: React.KeyboardEvent<HTMLInputElement>) => {
      // At start and pressing left arrow, focus the previous full token
      if (
        evt.currentTarget.selectionStart === 0 &&
        evt.currentTarget.selectionEnd === 0 &&
        evt.key === 'ArrowLeft'
      ) {
        focusTarget(state, state.collection.getKeyBefore(item.key));
        return;
      }

      // At end and pressing right arrow, focus the next full token
      if (
        evt.currentTarget.selectionStart === evt.currentTarget.value.length &&
        evt.currentTarget.selectionEnd === evt.currentTarget.value.length &&
        evt.key === 'ArrowRight'
      ) {
        focusTarget(state, state.collection.getKeyAfter(item.key));
        return;
      }
    },
    [state, item]
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
        const itemKey = state.collection.getKeyBefore(item.key);
        dispatch({
          type: 'DELETE_TOKEN',
          token,
          focusOverride: defined(itemKey) ? {itemKey} : undefined,
        });
      }

      // At end and pressing delete, focus the next full token
      if (
        evt.currentTarget.selectionStart === evt.currentTarget.value.length &&
        evt.currentTarget.selectionEnd === evt.currentTarget.value.length &&
        evt.key === 'Delete'
      ) {
        const itemKey = state.collection.getKeyBefore(item.key);
        dispatch({
          type: 'DELETE_TOKEN',
          token,
          focusOverride: defined(itemKey) ? {itemKey} : undefined,
        });
      }
    },
    [dispatch, token, state, item]
  );

  const onOptionSelected = useCallback(
    (option: SelectOptionWithKey<string>) => {
      dispatch({
        text: `${token.function}(${option.value})`,
        type: 'REPLACE_TOKEN',
        token,
        focusOverride: {
          itemKey: nextTokenKeyOfKind(state, token, TokenKind.FREE_TEXT),
        },
      });
      resetInputValue();
    },
    [dispatch, state, token, resetInputValue]
  );

  const onPaste = useCallback((_evt: React.ClipboardEvent<HTMLInputElement>) => {
    // TODO
  }, []);

  return (
    <Fragment>
      <ComboBox
        ref={inputRef}
        items={items}
        placeholder={attribute.attribute}
        inputLabel={t('Select an attribute')}
        inputValue={inputValue}
        filterValue={filterValue}
        tabIndex={item.key === state.selectionManager.focusedKey ? 0 : -1}
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
          state.collection.getLastKey() === item.key
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
    </Fragment>
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
    <DeleteButton aria-label={t('Remove function %s', token.format())} onClick={onClick}>
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

const FunctionArgumentOverlay = styled('div')`
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
