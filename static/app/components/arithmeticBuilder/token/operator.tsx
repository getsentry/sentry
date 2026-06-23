import type {KeyboardEvent, MouseEvent} from 'react';
import {useCallback, useRef} from 'react';
import styled from '@emotion/styled';
import type {ListState} from '@react-stately/list';
import type {Node} from '@react-types/shared';

import InteractionStateLayer from '@sentry/scraps/interactionStateLayer';

import {useArithmeticBuilder} from 'sentry/components/arithmeticBuilder/context';
import type {Token, TokenOperator} from 'sentry/components/arithmeticBuilder/token';
import {Operator} from 'sentry/components/arithmeticBuilder/token';
import {useGridListItem} from 'sentry/components/tokenizedInput/grid/useGridListItem';
import {focusTarget} from 'sentry/components/tokenizedInput/grid/utils';
import {shiftFocusToChild} from 'sentry/components/tokenizedInput/token/utils';
import {IconAdd} from 'sentry/icons/iconAdd';
import {IconClose} from 'sentry/icons/iconClose';
import {IconDivide} from 'sentry/icons/iconDivide';
import {IconSubtract} from 'sentry/icons/iconSubtract';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils/defined';

interface ArithmeticTokenOperatorProps {
  item: Node<Token>;
  state: ListState<Token>;
  token: TokenOperator;
}

export function ArithmeticTokenOperator({
  item,
  state,
  token,
}: ArithmeticTokenOperatorProps) {
  const ref = useRef<HTMLDivElement>(null);
  const {dispatch} = useArithmeticBuilder();
  const {rowProps, gridCellProps} = useGridListItem({
    item,
    ref,
    state,
    focusable: true,
  });

  const operator =
    token.operator === Operator.PLUS ? (
      <IconAdd size="xs" />
    ) : token.operator === Operator.MINUS ? (
      <IconSubtract size="xs" />
    ) : token.operator === Operator.MULTIPLY ? (
      <IconClose size="xs" data-test-id="icon-multiply" />
    ) : token.operator === Operator.DIVIDE ? (
      <IconDivide size="xs" />
    ) : null;

  if (!operator) {
    throw new Error(`Unexpected operator: ${token.operator}`);
  }

  const onDelete = useCallback(
    (evt: KeyboardEvent<HTMLDivElement> | MouseEvent<HTMLButtonElement>) => {
      evt.preventDefault();
      evt.stopPropagation();
      const itemKey = state.collection.getKeyBefore(item.key);
      dispatch({
        type: 'DELETE_TOKEN',
        token,
        focusOverride: defined(itemKey) ? {itemKey} : undefined,
      });
    },
    [dispatch, token, state, item]
  );

  const onKeyDownCapture = useCallback(
    (evt: KeyboardEvent<HTMLInputElement>) => {
      if (evt.key === 'ArrowLeft') {
        focusTarget(state, state.collection.getKeyBefore(item.key));
        return;
      }

      if (evt.key === 'ArrowRight') {
        focusTarget(state, state.collection.getKeyAfter(item.key));
        return;
      }
    },
    [state, item]
  );

  const handleOnKeyDown = useCallback(
    (evt: KeyboardEvent<HTMLDivElement>) => {
      if (evt.key === 'Backspace' || evt.key === 'Delete') {
        onDelete?.(evt);
      }
    },
    [onDelete]
  );

  const handleOnClick = useCallback(
    (evt: MouseEvent<HTMLDivElement>) => {
      evt.stopPropagation();
      shiftFocusToChild(evt.currentTarget, item, state);
    },
    [item, state]
  );

  return (
    <Wrapper
      {...rowProps}
      onClick={handleOnClick}
      onKeyDown={handleOnKeyDown}
      onKeyDownCapture={onKeyDownCapture}
      aria-invalid={false}
      ref={ref}
    >
      {operator}
      <HoverFocusBorder>
        <FloatingCloseButton
          {...gridCellProps}
          tabIndex={-1}
          aria-label={t('Delete %s', token.operator)}
          onClick={onDelete}
        >
          <InteractionStateLayer />
          <IconClose legacySize="10px" />
        </FloatingCloseButton>
      </HoverFocusBorder>
    </Wrapper>
  );
}

const FloatingCloseButton = styled('button')`
  background: ${p => p.theme.tokens.background.primary};
  outline: none;
  user-select: none;
  padding: 0;
  border: none;
  color: ${p => p.theme.tokens.content.secondary};
  border-radius: 0 0 2px 2px;
  /* eslint-disable-next-line @sentry/scraps/use-semantic-token */
  box-shadow: 0 0 0 1px ${p => p.theme.tokens.border.secondary};
  display: flex;
  align-items: center;
  justify-content: center;
  position: absolute;
  bottom: -14px;
  height: 14px;
  width: 100%;

  &:focus,
  &:hover {
    outline: none;
    border: none;
    background: ${p => p.theme.tokens.background.primary};
  }

  &:focus-visible {
    box-shadow: 0 0 0 1px ${p => p.theme.tokens.focus.default};
  }
`;

const Wrapper = styled('div')`
  position: relative;
  height: 24px;
  border-radius: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: fit-content;

  &:focus {
    outline: none;
  }

  &[aria-selected='true'] {
    background-color: ${p => p.theme.colors.gray100};
  }

  &[aria-invalid='true'] {
    color: ${p => p.theme.colors.red500};
  }

  /* Need to hide visually but keep focusable */
  &:not(:hover):not(:focus-within) {
    color: ${p => p.theme.tokens.content.secondary};

    &[aria-invalid='true'] {
      color: ${p => p.theme.colors.red500};
    }

    ${FloatingCloseButton} {
      ${p => p.theme.visuallyHidden}
    }
  }
`;

const HoverFocusBorder = styled('div')`
  position: absolute;
  top: 50%;
  left: 50%;
  height: 33px;
  transform: translate(-50%, -50%);
  border-radius: 2px 2px 0 0;
  min-width: 14px;
  width: calc(100% + 4px);

  &:focus-within,
  &:hover {
    box-shadow: 0 0 0 1px ${p => p.theme.tokens.focus.default};
  }
`;
