import {useCallback, useLayoutEffect, useMemo, useRef, type PointerEvent} from 'react';
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
  isTokenLiteral,
  isTokenOperator,
  isTokenParenthesis,
  isTokenReference,
} from 'sentry/components/arithmeticBuilder/token';
import {ArithmeticTokenFreeText} from 'sentry/components/arithmeticBuilder/token/freeText';
import {ArithmeticTokenFunction} from 'sentry/components/arithmeticBuilder/token/function';
import {ArithmeticTokenLiteral} from 'sentry/components/arithmeticBuilder/token/literal';
import {ArithmeticTokenOperator} from 'sentry/components/arithmeticBuilder/token/operator';
import {ArithmeticTokenParenthesis} from 'sentry/components/arithmeticBuilder/token/parenthesis';
import {ArithmeticBuilderTokenReference} from 'sentry/components/arithmeticBuilder/token/reference';
import {computeNextAllowedTokenKinds} from 'sentry/components/arithmeticBuilder/validator';
import {useGridList} from 'sentry/components/tokenizedInput/grid/useGridList';
import {focusTarget} from 'sentry/components/tokenizedInput/grid/utils';
import {shiftFocusToChild} from 'sentry/components/tokenizedInput/token/utils';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils/defined';

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

  const onGridPaddingPointerDown = useCallback(
    (evt: PointerEvent<HTMLDivElement>) => {
      if (evt.target !== evt.currentTarget) {
        gridProps.onPointerDown?.(evt);
        return;
      }

      // Padding clicks would otherwise focus the grid itself, which has no caret.
      evt.preventDefault();

      const rows = Array.from(
        evt.currentTarget.querySelectorAll<HTMLElement>('[role="row"]')
      ).filter(row => row.closest('[role="grid"]') === evt.currentTarget);

      const collectionItems = Array.from(state.collection);

      // Prefer free-text rows (caret targets). Match by token kind rather than
      // translated aria-label so padding clicks work in every locale. The leading
      // spacer is zero-width so start clicks usually land on grid padding —
      // resolve those to the first / last free-text field by edge, otherwise the
      // nearest free-text caret.
      const freeTextRows = rows.filter((_, index) =>
        isTokenFreeText(collectionItems[index]?.value)
      );
      const candidates = freeTextRows.length > 0 ? freeTextRows : rows;
      const nearestRow = resolvePaddingClickRow(
        candidates,
        evt.currentTarget.getBoundingClientRect(),
        evt.clientX,
        evt.clientY
      );
      if (!nearestRow) {
        return;
      }

      const rowIndex = rows.indexOf(nearestRow);
      const item = collectionItems[rowIndex];
      if (!item) {
        return;
      }

      focusTarget(state, item.key);
      shiftFocusToChild(nearestRow, item, state);
    },
    [gridProps, state]
  );

  const nextAllowedTokenKindsAtIndex = useMemo(() => {
    const tokens = Array.from(state.collection, item => item.value);
    return computeNextAllowedTokenKinds(tokens);
  }, [state.collection]);

  return (
    <TokenGridWrapper {...gridProps} onPointerDown={onGridPaddingPointerDown} ref={ref}>
      {Array.from(state.collection, (item, i) => {
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

        if (isTokenReference(token)) {
          return (
            <ArithmeticBuilderTokenReference
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

        if (isTokenLiteral(token)) {
          return (
            <ArithmeticTokenLiteral
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
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  max-width: 100%;
  min-height: 100%;
  /* Match SearchQueryBuilder so equation and aggregate filter rows share height.
   * +1px accounts for the border; keep horizontal padding so empty-field clicks
   * still land on this grid and route into an input. */
  padding-top: calc(${p => p.theme.space.xs} + 1px);
  padding-bottom: calc(${p => p.theme.space.xs} + 1px);
  padding-left: ${p => p.theme.space.sm};
  padding-right: ${p => p.theme.space.sm};
  display: flex;
  align-items: stretch;
  row-gap: ${p => p.theme.space.xs};
  flex-wrap: wrap;
  cursor: text;

  &:focus {
    outline: none;
  }
`;

/**
 * Leading free-text is zero-width (avoids wrapping a full-width `_if` token onto
 * the next line), so start-of-equation clicks land on grid padding. Prefer the
 * first/last free-text field when the pointer is near those edges; otherwise use
 * the nearest free-text caret (mid-expression gaps, trailing field, etc.).
 */
export function resolvePaddingClickRow(
  rows: HTMLElement[],
  gridRect: Pick<DOMRect, 'left' | 'width'>,
  clientX: number,
  clientY: number
): HTMLElement | undefined {
  if (!rows.length) {
    return undefined;
  }

  const relativeX = gridRect.width > 0 ? (clientX - gridRect.left) / gridRect.width : 0.5;

  // Edge zones restore click-to-edit at the start/end without bringing back the
  // old vertical first/last split that opened two menus on wrapped equations.
  const START_EDGE_RATIO = 0.2;
  const END_EDGE_RATIO = 0.8;
  if (relativeX <= START_EDGE_RATIO) {
    return rows[0];
  }
  if (relativeX >= END_EDGE_RATIO) {
    return rows.at(-1);
  }

  return findNearestRow(rows, clientX, clientY);
}

/**
 * Pick the token row whose box is closest to the pointer.
 */
export function findNearestRow(
  rows: HTMLElement[],
  clientX: number,
  clientY: number
): HTMLElement | undefined {
  let nearest: HTMLElement | undefined;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const row of rows) {
    const rect = row.getBoundingClientRect();
    const dx =
      clientX < rect.left
        ? rect.left - clientX
        : clientX > rect.right
          ? clientX - rect.right
          : 0;
    const dy =
      clientY < rect.top
        ? rect.top - clientY
        : clientY > rect.bottom
          ? clientY - rect.bottom
          : 0;
    const distance = dx * dx + dy * dy;
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = row;
    } else if (distance === nearestDistance) {
      // Prefer later free-text when distances tie (jsdom zero rects, overlapping
      // spacers). Empty-field clicks should land on the trailing caret.
      nearest = row;
    }
  }

  return nearest;
}
