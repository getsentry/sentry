import {useLayoutEffect, useRef} from 'react';
import styled from '@emotion/styled';
import type {AriaGridListOptions} from '@react-aria/gridlist';
import {Item} from '@react-stately/collections';
import type {ListState} from '@react-stately/list';
import {useListState} from '@react-stately/list';
import type {CollectionChildren} from '@react-types/shared';

import {useSearchQueryBuilder} from 'sentry/components/searchQueryBuilder/context';
import {useQueryBuilderGrid} from 'sentry/components/searchQueryBuilder/hooks/useQueryBuilderGrid';
import {useSelectOnDrag} from 'sentry/components/searchQueryBuilder/hooks/useSelectOnDrag';
import {useUndoStack} from 'sentry/components/searchQueryBuilder/hooks/useUndoStack';
import {SelectionKeyHandler} from 'sentry/components/searchQueryBuilder/selectionKeyHandler';
import {SearchQueryBuilderBoolean} from 'sentry/components/searchQueryBuilder/tokens/boolean';
import {SearchQueryBuilderFilter} from 'sentry/components/searchQueryBuilder/tokens/filter/filter';
import {SearchQueryBuilderFreeText} from 'sentry/components/searchQueryBuilder/tokens/freeText';
import {SearchQueryBuilderParen} from 'sentry/components/searchQueryBuilder/tokens/paren';
import {makeTokenKey} from 'sentry/components/searchQueryBuilder/utils';
import {type ParseResultToken, Token} from 'sentry/components/searchSyntax/parser';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

interface TokenizedQueryGridProps {
  label?: string;
}

interface GridProps extends AriaGridListOptions<ParseResultToken> {
  children: CollectionChildren<ParseResultToken>;
  items: ParseResultToken[];
}

function useApplyFocusOverride(state: ListState<ParseResultToken>) {
  const {focusOverride, dispatch} = useSearchQueryBuilder();

  useLayoutEffect(() => {
    if (focusOverride && !focusOverride.part) {
      state.selectionManager.setFocused(true);
      state.selectionManager.setFocusedKey(focusOverride.itemKey);
      dispatch({type: 'RESET_FOCUS_OVERRIDE'});
    }
  }, [dispatch, focusOverride, state.selectionManager]);
}

function Grid(props: GridProps) {
  const ref = useRef<HTMLDivElement>(null);
  const selectionKeyHandlerRef = useRef<HTMLInputElement>(null);
  const {size} = useSearchQueryBuilder();
  const state = useListState<ParseResultToken>({
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
  const {undo} = useUndoStack(state);
  const {gridProps} = useQueryBuilderGrid({
    props,
    state,
    ref,
    selectionKeyHandlerRef,
    undo,
  });
  useApplyFocusOverride(state);
  useSelectOnDrag(state);

  return (
    <SearchQueryGridWrapper {...gridProps} ref={ref} size={size}>
      <SelectionKeyHandler ref={selectionKeyHandlerRef} state={state} undo={undo} />
      {[...state.collection].map(item => {
        const token = item.value;

        switch (token?.type) {
          case Token.FILTER:
            return (
              <SearchQueryBuilderFilter
                key={item.key}
                token={token}
                item={item}
                state={state}
              />
            );
          case Token.FREE_TEXT:
          case Token.SPACES:
            return (
              <SearchQueryBuilderFreeText
                key={item.key}
                token={token}
                item={item}
                state={state}
              />
            );
          case Token.L_PAREN:
          case Token.R_PAREN:
            return (
              <SearchQueryBuilderParen
                key={item.key}
                token={token}
                item={item}
                state={state}
              />
            );
          case Token.LOGIC_BOOLEAN:
            return (
              <SearchQueryBuilderBoolean
                key={item.key}
                token={token}
                item={item}
                state={state}
              />
            );
          // TODO(malwilley): Add other token types
          default:
            return null;
        }
      })}
    </SearchQueryGridWrapper>
  );
}

export function TokenizedQueryGrid({label}: TokenizedQueryGridProps) {
  const {parsedQuery} = useSearchQueryBuilder();

  // Shouldn't ever get here since we will render the plain text input instead
  if (!parsedQuery) {
    return null;
  }

  return (
    <Grid
      aria-label={label ?? t('Create a search query')}
      items={parsedQuery}
      selectionMode="multiple"
    >
      {item => (
        <Item key={makeTokenKey(item, parsedQuery)}>
          {item.text.trim() ? item.text : t('Space')}
        </Item>
      )}
    </Grid>
  );
}

const SearchQueryGridWrapper = styled('div')<{size: 'small' | 'normal'}>`
  padding: ${p =>
    p.size === 'small' ? space(0.75) : `${space(0.75)} 34px ${space(0.75)} 32px`};
  display: flex;
  align-items: stretch;
  row-gap: ${space(0.5)};
  flex-wrap: wrap;

  &:focus {
    outline: none;
  }
`;
