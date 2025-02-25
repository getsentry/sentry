import {useLayoutEffect, useMemo, useRef} from 'react';
import styled from '@emotion/styled';
import type {AriaGridListOptions} from '@react-aria/gridlist';
import {Item} from '@react-stately/collections';
import type {ListState} from '@react-stately/list';
import {useListState} from '@react-stately/list';
import type {CollectionChildren} from '@react-types/shared';
import * as Sentry from '@sentry/react';

import {useArithmeticBuilder} from 'sentry/components/arithmeticBuilder/context';
import type {Token} from 'sentry/components/arithmeticBuilder/token';
import {
  isTokenFreeText,
  isTokenFunction,
  isTokenOperator,
  isTokenParenthesis,
} from 'sentry/components/arithmeticBuilder/token';
import {ArithmeticTokenFreeText} from 'sentry/components/arithmeticBuilder/token/freeText';
import {ArithmeticTokenFunction} from 'sentry/components/arithmeticBuilder/token/function';
import {ArithmeticTokenOperator} from 'sentry/components/arithmeticBuilder/token/operator';
import {ArithmeticTokenParenthesis} from 'sentry/components/arithmeticBuilder/token/parenthesis';
import {computeNextAllowedTokenKinds} from 'sentry/components/arithmeticBuilder/validator';
import {useGridList} from 'sentry/components/tokenizedInput/grid/useGridList';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';

interface TokenGridProps {
  tokens: Token[];
}

export function TokenGrid({tokens}: TokenGridProps) {
  if (tokens.length <= 0) {
    throw new Error('No tokens found. Cannot render grid.');
  }

  const isEmptyGrid = tokens.length === 1 && isTokenFreeText(tokens[0]);

  return (
    <GridList
      showPlaceholder={isEmptyGrid}
      aria-label={t('Enter an equation')}
      items={tokens}
      selectionMode="multiple"
    >
      {item => <Item key={item.key}>{item.key}</Item>}
    </GridList>
  );
}

function useApplyFocusOverride(state: ListState<Token>) {
  const {focusOverride, dispatch} = useArithmeticBuilder();

  useLayoutEffect(() => {
    /**
     * Focus overrides are used to switch focus between the different tokens.
     * One use case of this is when creating a parenthesis token from a free
     * text token, the focus should move to the input after the new parenthesis
     * token. Otherwise, keeping it at the current input means it'll be before
     * the parenthesis.
     *
     * Focus overrides work by updating the context with the desired focus.
     * Then on render, we force the focus to be on the specified item.
     *
     * Once the focus has been updated, make sure we clear the override so
     * on next render, we do not try to update the focus again.
     */
    if (focusOverride) {
      state.selectionManager.setFocused(true);
      state.selectionManager.setFocusedKey(focusOverride.itemKey);
      dispatch({type: 'RESET_FOCUS_OVERRIDE'});
    }
  }, [dispatch, focusOverride, state.collection, state.selectionManager]);
}

interface GridListProps extends AriaGridListOptions<Token> {
  children: CollectionChildren<Token>;
  showPlaceholder: boolean;
}

function GridList({showPlaceholder, ...props}: GridListProps) {
  const ref = useRef<HTMLDivElement>(null);
  const selectionKeyHandlerRef = useRef<HTMLInputElement>(null); // TODO: implement

  const state = useListState<Token>({
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

  useApplyFocusOverride(state);

  const nextAllowedTokenKindsAtIndex = useMemo(() => {
    const tokens = [...state.collection].map(item => item.value);
    return computeNextAllowedTokenKinds(tokens);
  }, [state.collection]);

  return (
    <TokenGridWrapper {...gridProps} ref={ref}>
      {[...state.collection].map((item, i) => {
        const token = item.value;

        if (!defined(token)) {
          return null;
        }

        if (isTokenParenthesis(token)) {
          return (
            <ArithmeticTokenParenthesis
              key={item.key}
              item={item}
              state={state}
              token={token}
            />
          );
        }

        if (isTokenOperator(token)) {
          return (
            <ArithmeticTokenOperator
              key={item.key}
              item={item}
              state={state}
              token={token}
            />
          );
        }

        if (isTokenFreeText(token)) {
          return (
            <ArithmeticTokenFreeText
              key={item.key}
              item={item}
              state={state}
              token={token}
              showPlaceholder={showPlaceholder}
              nextAllowedTokenKinds={nextAllowedTokenKindsAtIndex[i]!}
            />
          );
        }

        if (isTokenFunction(token)) {
          return (
            <ArithmeticTokenFunction
              key={item.key}
              item={item}
              state={state}
              token={token}
            />
          );
        }

        Sentry.captureMessage(`Unknown token: ${token.kind}`);
        return null;
      })}
    </TokenGridWrapper>
  );
}

const TokenGridWrapper = styled('div')`
  padding: ${space(0.75)};
  display: flex;
  align-items: stretch;
  row-gap: ${space(0.5)};
  flex-wrap: wrap;

  &:focus {
    outline: none;
  }
`;
