import type {ChangeEvent, FocusEvent} from 'react';
import {Fragment, useCallback, useRef, useState} from 'react';
import styled from '@emotion/styled';
import type {ListState} from '@react-stately/list';
import type {KeyboardEvent, Node} from '@react-types/shared';

import {useArithmeticBuilder} from 'sentry/components/arithmeticBuilder/context';
import type {Token, TokenLiteral} from 'sentry/components/arithmeticBuilder/token';
import {
  isTokenOperator,
  isTokenParenthesis,
  TokenKind,
} from 'sentry/components/arithmeticBuilder/token';
import {
  nextTokenKeyOfKind,
  tokenizeExpression,
} from 'sentry/components/arithmeticBuilder/tokenizer';
import InteractionStateLayer from 'sentry/components/core/interactionStateLayer';
import {useGridListItem} from 'sentry/components/tokenizedInput/grid/useGridListItem';
import {focusTarget} from 'sentry/components/tokenizedInput/grid/utils';
import {InputBox} from 'sentry/components/tokenizedInput/token/inputBox';
import {IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';

interface ArithmeticTokenLiteralProps {
  item: Node<Token>;
  state: ListState<Token>;
  token: TokenLiteral;
}

export function ArithmeticTokenLiteral({
  item,
  state,
  token,
}: ArithmeticTokenLiteralProps) {
  const ref = useRef<HTMLDivElement>(null);
  const {rowProps, gridCellProps} = useGridListItem({
    item,
    ref,
    state,
    focusable: true,
  });

  return (
    <Row
      {...rowProps}
      ref={ref}
      tabIndex={-1}
      aria-label={token.text}
      aria-invalid={false}
    >
      <LeftGridCell {...gridCellProps}>
        <InternalInput item={item} state={state} token={token} />
      </LeftGridCell>
      <GridCell {...gridCellProps}>
        <DeleteLiteral token={token} />
      </GridCell>
    </Row>
  );
}

interface InternalInputProps extends ArithmeticTokenLiteralProps {}

function InternalInput({item, state, token}: InternalInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useState(token.text);
  const [_selectionIndex, setSelectionIndex] = useState(0); // TODO

  const updateSelectionIndex = useCallback(() => {
    setSelectionIndex(inputRef.current?.selectionStart ?? 0);
  }, [setSelectionIndex]);

  const resetInputValue = useCallback(() => {
    updateSelectionIndex();
  }, [updateSelectionIndex]);

  const {dispatch} = useArithmeticBuilder();

  const onClick = useCallback(() => {
    updateSelectionIndex();
  }, [updateSelectionIndex]);

  const onInputBlur = useCallback(() => {
    resetInputValue();
  }, [resetInputValue]);

  const onInputChange = useCallback(
    (evt: ChangeEvent<HTMLInputElement>) => {
      const text = evt.target.value;

      if (text.length <= 0) {
        dispatch({
          text,
          type: 'REPLACE_TOKEN',
          token,
          focusOverride: {
            itemKey: nextTokenKeyOfKind(state, token, TokenKind.FREE_TEXT),
          },
        });
        resetInputValue();
        return;
      }

      const last = text.substring(text.length - 1);

      if (last === ' ') {
        const trimmed = text.substring(0, text.length - 1);
        if (validateLiteral(text)) {
          dispatch({
            text: trimmed,
            type: 'REPLACE_TOKEN',
            token,
            focusOverride: {
              itemKey: nextTokenKeyOfKind(state, token, TokenKind.FREE_TEXT),
            },
          });
        }
        resetInputValue();
        return;
      }

      const tokens = tokenizeExpression(last);
      if (tokens.some(tok => isTokenOperator(tok) || isTokenParenthesis(tok))) {
        const trimmed = text.substring(0, text.length - 1);
        if (validateLiteral(trimmed)) {
          dispatch({
            text,
            type: 'REPLACE_TOKEN',
            token,
            focusOverride: {
              itemKey: nextTokenKeyOfKind(state, token, TokenKind.FREE_TEXT, 2),
            },
          });
        }
        resetInputValue();
        return;
      }

      if (validateLiteral(text)) {
        setInputValue(evt.target.value);
        setSelectionIndex(evt.target.selectionStart ?? 0);
      }
    },
    [dispatch, state, token, resetInputValue]
  );

  const onInputCommit = useCallback(() => {
    const trimmed = inputValue.trim();
    const text = validateLiteral(trimmed) ? trimmed : token.text;
    dispatch({
      text,
      type: 'REPLACE_TOKEN',
      token,
      focusOverride: {
        itemKey: nextTokenKeyOfKind(state, token, TokenKind.FREE_TEXT),
      },
    });
    resetInputValue();
  }, [dispatch, state, token, inputValue, resetInputValue]);

  const onInputEscape = useCallback(() => {
    const text = inputValue.trim();
    if (validateLiteral(text)) {
      dispatch({
        type: 'REPLACE_TOKEN',
        token,
        text,
      });
    }
    resetInputValue();
  }, [dispatch, inputValue, token, resetInputValue]);

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

  return (
    <Fragment>
      <InputBox
        ref={inputRef}
        inputLabel={t('Add a literal')}
        inputValue={inputValue}
        tabIndex={-1}
        onClick={onClick}
        onInputBlur={onInputBlur}
        onInputChange={onInputChange}
        onInputCommit={onInputCommit}
        onInputEscape={onInputEscape}
        onInputFocus={onInputFocus}
        onKeyDown={onKeyDown}
        onKeyDownCapture={onKeyDownCapture}
      />
    </Fragment>
  );
}

interface DeleteLiteralProps {
  token: TokenLiteral;
}

function DeleteLiteral({token}: DeleteLiteralProps) {
  const {dispatch} = useArithmeticBuilder();

  const onClick = useCallback(() => {
    dispatch({
      type: 'DELETE_TOKEN',
      token,
    });
  }, [dispatch, token]);

  return (
    <DeleteButton aria-label={t('Remove literal %s', token.text)} onClick={onClick}>
      <InteractionStateLayer />
      <IconClose legacySize="8px" />
    </DeleteButton>
  );
}

function validateLiteral(text: string): boolean {
  return !!text && !isNaN(+text);
}

const Row = styled('div')`
  position: relative;
  display: flex;
  align-items: stretch;
  height: 24px;
  max-width: 100%;
  border: 1px solid ${p => p.theme.tokens.border.secondary};
  border-radius: ${p => p.theme.radius.md};

  :focus {
    background-color: ${p => p.theme.colors.gray100};
    outline: none;
  }

  &:last-child {
    flex-grow: 1;
  }

  &[aria-invalid='true'] {
    input {
      color: ${p => p.theme.colors.red500};
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
      background-color: ${p => p.theme.colors.gray100};
    }
  }
`;

const GridCell = styled('div')`
  display: flex;
  align-items: center;
  position: relative;
  height: 100%;
`;

const LeftGridCell = styled(GridCell)`
  padding-left: ${space(0.5)};
`;

const DeleteButton = styled('button')`
  background: none;
  border: none;
  color: ${p => p.theme.tokens.content.secondary};
  outline: none;
  user-select: none;
  padding-right: ${space(0.5)};

  :focus {
    background-color: ${p => p.theme.colors.gray100};
    border-left: 1px solid ${p => p.theme.tokens.border.secondary};
    outline: none;
  }
`;
