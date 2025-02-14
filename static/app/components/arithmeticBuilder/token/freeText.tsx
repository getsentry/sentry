import type {ChangeEvent, FocusEvent, MouseEvent, RefObject} from 'react';
import {Fragment, useCallback, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {Item, Section} from '@react-stately/collections';
import type {ListState} from '@react-stately/list';
import type {KeyboardEvent, Node} from '@react-types/shared';

import {useArithmeticBuilder} from 'sentry/components/arithmeticBuilder/context';
import type {Token, TokenFreeText} from 'sentry/components/arithmeticBuilder/token';
import {
  isTokenFreeText,
  isTokenFunction,
  isTokenOperator,
  isTokenParenthesis,
  TokenKind,
} from 'sentry/components/arithmeticBuilder/token';
import {
  nextSimilarTokenKey,
  nextTokenKeyOfKind,
  tokenizeExpression,
} from 'sentry/components/arithmeticBuilder/tokenizer';
import type {SelectOptionWithKey} from 'sentry/components/compactSelect/types';
import {itemIsSection} from 'sentry/components/searchQueryBuilder/tokens/utils';
import {useGridListItem} from 'sentry/components/tokenizedInput/grid/useGridListItem';
import {focusTarget} from 'sentry/components/tokenizedInput/grid/utils';
import {ComboBox} from 'sentry/components/tokenizedInput/token/comboBox';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {ALLOWED_EXPLORE_VISUALIZE_AGGREGATES} from 'sentry/utils/fields';

interface ArithmeticTokenFreeTextProps {
  item: Node<Token>;
  showPlaceholder: boolean;
  state: ListState<Token>;
  token: TokenFreeText;
}

export function ArithmeticTokenFreeText({
  showPlaceholder,
  item,
  state,
  token,
}: ArithmeticTokenFreeTextProps) {
  const ref = useRef<HTMLDivElement>(null);
  const {rowProps, gridCellProps} = useGridListItem({
    item,
    ref,
    state,
  });

  return (
    <Row
      {...rowProps}
      ref={ref}
      tabIndex={-1}
      aria-label={token.text}
      aria-invalid={false}
    >
      <GridCell {...gridCellProps} onClick={stopPropagation}>
        <InternalInput
          showPlaceholder={showPlaceholder}
          item={item}
          state={state}
          token={token}
          rowRef={ref}
        />
      </GridCell>
    </Row>
  );
}

interface InternalInputProps extends ArithmeticTokenFreeTextProps {
  rowRef: RefObject<HTMLDivElement>;
}

function InternalInput({
  showPlaceholder,
  item,
  state,
  token,
  rowRef,
}: InternalInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const trimmedTokenValue = token.text.trim();
  const [inputValue, setInputValue] = useState(trimmedTokenValue);
  const [_selectionIndex, setSelectionIndex] = useState(0); // TODO
  const [_isOpen, setIsOpen] = useState(false); // TODO

  const filterValue = inputValue.trim();

  // When token value changes, reset the input value
  const [prevValue, setPrevValue] = useState(inputValue);
  if (trimmedTokenValue !== prevValue) {
    setPrevValue(trimmedTokenValue);
    setInputValue(trimmedTokenValue);
  }

  const updateSelectionIndex = useCallback(() => {
    setSelectionIndex(inputRef.current?.selectionStart ?? 0);
  }, [setSelectionIndex]);

  const resetInputValue = useCallback(() => {
    setInputValue(trimmedTokenValue);
    updateSelectionIndex();
  }, [trimmedTokenValue, updateSelectionIndex]);

  const {dispatch} = useArithmeticBuilder();

  const allowedFunctions: string[] = useMemo(() => {
    return ALLOWED_EXPLORE_VISUALIZE_AGGREGATES;
  }, []);

  const items = useFunctionItems({
    allowedFunctions,
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
    dispatch({
      type: 'REPLACE_TOKEN',
      token,
      text: inputValue.trim(),
    });
    resetInputValue();
  }, [dispatch, inputValue, token, resetInputValue]);

  const onInputChange = useCallback(
    (evt: ChangeEvent<HTMLInputElement>) => {
      const text = evt.target.value;

      const tokens = tokenizeExpression(text);

      for (const tok of tokens) {
        if (isTokenParenthesis(tok) || isTokenOperator(tok) || isTokenFunction(tok)) {
          dispatch({
            type: 'REPLACE_TOKEN',
            token,
            text,
            focusOverride: {itemKey: nextSimilarTokenKey(token.key)},
          });
          resetInputValue();
          return;
        }

        if (isTokenFreeText(tok)) {
          const input = text.trim();
          if (input.endsWith('(')) {
            const pos = input.lastIndexOf(' ');
            const maybeFunc = input.substring(pos + 1, input.length - 1);
            if (allowedFunctions.includes(maybeFunc)) {
              dispatch({
                type: 'REPLACE_TOKEN',
                token,
                text: `${input.substring(0, pos + 1)}${getInitialText(maybeFunc)}`,
                focusOverride: {
                  itemKey: nextTokenKeyOfKind(state, token, TokenKind.FUNCTION),
                },
              });
              resetInputValue();
              return;
            }
          }
        }
      }

      setInputValue(evt.target.value);
      setSelectionIndex(evt.target.selectionStart ?? 0);
    },
    [allowedFunctions, dispatch, resetInputValue, setInputValue, state, token]
  );

  const onInputCommit = useCallback(() => {
    dispatch({
      type: 'REPLACE_TOKEN',
      token,
      text: inputValue.trim(),
    });
    resetInputValue();
  }, [dispatch, inputValue, token, resetInputValue]);

  const onInputEscape = useCallback(() => {
    dispatch({
      type: 'REPLACE_TOKEN',
      token,
      text: inputValue,
    });
    resetInputValue();
  }, [dispatch, token, inputValue, resetInputValue]);

  const onInputFocus = useCallback((_evt: FocusEvent<HTMLInputElement>) => {
    // TODO
  }, []);

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

      // At start and pressing backspace, focus the previous full token
      if (
        evt.currentTarget.selectionStart === 0 &&
        evt.currentTarget.selectionEnd === 0 &&
        evt.key === 'Backspace'
      ) {
        focusTarget(state, state.collection.getKeyBefore(item.key));
        return;
      }

      // At end and pressing delete, focus the next full token
      if (
        evt.currentTarget.selectionStart === evt.currentTarget.value.length &&
        evt.currentTarget.selectionEnd === evt.currentTarget.value.length &&
        evt.key === 'Delete'
      ) {
        focusTarget(state, state.collection.getKeyAfter(item.key));
        return;
      }
    },
    [state, item]
  );

  const onOptionSelected = useCallback(
    (option: SelectOptionWithKey<string>) => {
      // TODO: assumes we only autocomplete functions
      // need to figure out parens and operators

      dispatch({
        type: 'REPLACE_TOKEN',
        token,
        text: getInitialText(option.value),
        focusOverride: {itemKey: nextTokenKeyOfKind(state, token, TokenKind.FUNCTION)},
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
        placeholder={showPlaceholder ? t('Enter equation') : ''}
        inputLabel={t('Add a term')}
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
            ? 'arithmetic-builder-input'
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

function useFunctionItems({
  allowedFunctions,
  filterValue,
}: {
  allowedFunctions: string[];
  filterValue: string;
}): Array<SelectOptionWithKey<string>> {
  // TODO: use a config and maybe we want operators and parenthesis too
  const functions: Array<SelectOptionWithKey<string>> = useMemo(() => {
    const items = filterValue
      ? allowedFunctions.filter(agg => agg.includes(filterValue))
      : allowedFunctions;

    return items.map(item => ({
      key: item,
      label: `${item}(\u2026)`,
      value: item,
      hideCheck: true,
    }));
  }, [allowedFunctions, filterValue]);

  return functions;
}

function stopPropagation(evt: MouseEvent<HTMLElement>) {
  evt.stopPropagation();
}

function getInitialText(key: string) {
  // TODO: generate this
  return `${key}(span.duration)`;
}

const Row = styled('div')`
  position: relative;
  display: flex;
  align-items: stretch;
  height: 24px;
  max-width: 100%;

  &:last-child {
    flex-grow: 1;
  }

  &[aria-invalid='true'] {
    input {
      color: ${p => p.theme.red400};
    }
  }

  &[aria-selected='true'] {
    [data-hidden-text='true']::before {
      content: '';
      position: absolute;
      left: ${space(0.5)};
      right: ${space(0.5)};
      top: 0;
      bottom: 0;
      background-color: ${p => p.theme.gray100};
    }
  }

  input {
    &::selection {
      background-color: ${p => p.theme.gray100};
    }
  }
`;

const GridCell = styled('div')`
  position: relative;
  display: flex;
  align-items: stretch;
  height: 100%;
  width: 100%;

  input {
    padding: 0 ${space(0.5)};
    min-width: 9px;
    width: 100%;
  }
`;
