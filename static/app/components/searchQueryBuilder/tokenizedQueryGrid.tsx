import {useLayoutEffect, useRef} from 'react';
import styled from '@emotion/styled';
import type {AriaGridListOptions} from '@react-aria/gridlist';
import {Item} from '@react-stately/collections';
import type {ListState} from '@react-stately/list';
import type {CollectionChildren} from '@react-types/shared';

import {SearchQueryBuilderBoolean} from 'sentry/components/searchQueryBuilder/boolean';
import {useSearchQueryBuilder} from 'sentry/components/searchQueryBuilder/context';
import {SearchQueryBuilderFilter} from 'sentry/components/searchQueryBuilder/filter';
import {SearchQueryBuilderInput} from 'sentry/components/searchQueryBuilder/input';
import {SearchQueryBuilderParen} from 'sentry/components/searchQueryBuilder/paren';
import {useQueryBuilderGrid} from 'sentry/components/searchQueryBuilder/useQueryBuilderGrid';
import {useSelectOnDrag} from 'sentry/components/searchQueryBuilder/useSelectOnDrag';
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
  const {size} = useSearchQueryBuilder();
  const {state, gridProps} = useQueryBuilderGrid(props, ref);

  useApplyFocusOverride(state);
  useSelectOnDrag(state);

  return (
    <SearchQueryGridWrapper {...gridProps} ref={ref} size={size}>
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
              <SearchQueryBuilderInput
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
