import {useEffect, useMemo, useRef} from 'react';
import styled from '@emotion/styled';
import type {AriaGridListOptions} from '@react-aria/gridlist';
import {Item} from '@react-stately/collections';
import {useListState} from '@react-stately/list';
import type {CollectionChildren} from '@react-types/shared';

import {inputStyles} from 'sentry/components/input';
import {SearchQueryBuilerContext} from 'sentry/components/searchQueryBuilder/context';
import {SearchQueryBuilderFilter} from 'sentry/components/searchQueryBuilder/filter';
import {SearchQueryBuilderInput} from 'sentry/components/searchQueryBuilder/input';
import {useQueryBuilderGrid} from 'sentry/components/searchQueryBuilder/useQueryBuilderGrid';
import {useQueryBuilderState} from 'sentry/components/searchQueryBuilder/useQueryBuilderState';
import {
  collapseTextTokens,
  makeTokenKey,
} from 'sentry/components/searchQueryBuilder/utils';
import {
  type ParseResultToken,
  parseSearch,
  Token,
} from 'sentry/components/searchSyntax/parser';
import {IconSearch} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Tag, TagCollection} from 'sentry/types';
import PanelProvider from 'sentry/utils/panelProvider';

interface SearchQueryBuilderProps {
  getTagValues: (key: Tag, query: string) => Promise<string[]>;
  initialQuery: string;
  supportedKeys: TagCollection;
  label?: string;
  onChange?: (query: string) => void;
}

interface GridProps extends AriaGridListOptions<ParseResultToken> {
  children: CollectionChildren<ParseResultToken>;
}

function Grid(props: GridProps) {
  const ref = useRef<HTMLDivElement>(null);
  const state = useListState<ParseResultToken>(props);

  const {gridProps} = useQueryBuilderGrid(props, state, ref);

  return (
    <Wrapper {...gridProps} ref={ref}>
      <PositionedSearchIcon size="sm" />
      {[...state.collection].map(item => {
        const token = item.value;

        switch (token?.type) {
          case Token.FILTER:
            return (
              <SearchQueryBuilderFilter
                key={makeTokenKey(token)}
                token={token}
                item={item}
                state={state}
              />
            );
          case Token.SPACES:
          case Token.FREE_TEXT:
            return (
              <SearchQueryBuilderInput
                key={makeTokenKey(token)}
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
    </Wrapper>
  );
}

export function SearchQueryBuilder({
  label,
  initialQuery,
  supportedKeys,
  getTagValues,
  onChange,
}: SearchQueryBuilderProps) {
  const {state, dispatch} = useQueryBuilderState({initialQuery});

  const parsedQuery = useMemo(
    () => collapseTextTokens(parseSearch(state.query || ' ')),
    [state.query]
  );

  useEffect(() => {
    onChange?.(state.query);
  }, [onChange, state.query]);

  const contextValue = useMemo(() => {
    return {
      ...state,
      parsedQuery,
      keys: supportedKeys,
      getTagValues,
      dispatch,
    };
  }, [state, parsedQuery, supportedKeys, getTagValues, dispatch]);

  if (!parsedQuery) {
    return null;
  }

  return (
    <SearchQueryBuilerContext.Provider value={contextValue}>
      <PanelProvider>
        <Grid aria-label={label ?? t('Create a search query')} items={parsedQuery}>
          {item => (
            <Item key={makeTokenKey(item)}>
              {item.text.trim() ? item.text : t('Space')}
            </Item>
          )}
        </Grid>
      </PanelProvider>
    </SearchQueryBuilerContext.Provider>
  );
}

const Wrapper = styled('div')`
  ${inputStyles}
  height: auto;
  position: relative;

  display: flex;
  align-items: stretch;
  row-gap: ${space(0.5)};
  flex-wrap: wrap;
  font-size: ${p => p.theme.fontSizeMedium};
  padding: ${space(0.75)} ${space(0.75)} ${space(0.75)} 36px;
  cursor: text;

  :focus-within {
    border: 1px solid ${p => p.theme.focusBorder};
    box-shadow: 0 0 0 1px ${p => p.theme.focusBorder};
  }
`;

const PositionedSearchIcon = styled(IconSearch)`
  color: ${p => p.theme.subText};
  position: absolute;
  left: ${space(1.5)};
  top: ${space(0.75)};
  height: 22px;
`;
