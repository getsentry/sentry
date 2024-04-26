import {useEffect, useMemo, useRef} from 'react';
import styled from '@emotion/styled';

import {inputStyles} from 'sentry/components/input';
import {SearchQueryBuilerContext} from 'sentry/components/searchQueryBuilder/context';
import {SearchQueryBuilderFilter} from 'sentry/components/searchQueryBuilder/filter';
import {useQueryBuilderState} from 'sentry/components/searchQueryBuilder/useQueryBuilderState';
import {parseSearch, Token} from 'sentry/components/searchSyntax/parser';
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

export function SearchQueryBuilder({
  label,
  initialQuery,
  supportedKeys,
  getTagValues,
  onChange,
}: SearchQueryBuilderProps) {
  const {state, dispatch} = useQueryBuilderState({initialQuery});

  const parsedQuery = useMemo(() => parseSearch(state.query), [state.query]);

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

  const ref = useRef(null);

  return (
    <SearchQueryBuilerContext.Provider value={contextValue}>
      <Wrapper ref={ref} role="grid" aria-label={label ?? t('Create a search query')}>
        <PositionedSearchIcon size="sm" />
        <PanelProvider>
          {parsedQuery?.map(token => {
            switch (token?.type) {
              case Token.FILTER:
                return (
                  <SearchQueryBuilderFilter
                    key={token.location.start.offset}
                    token={token}
                  />
                );
              // TODO(malwilley): Add other token types
              default:
                return null;
            }
          }) ?? null}
        </PanelProvider>
        {/* TODO(malwilley): Add action buttons */}
      </Wrapper>
    </SearchQueryBuilerContext.Provider>
  );
}

const Wrapper = styled('div')`
  ${inputStyles}
  height: auto;
  position: relative;

  display: flex;
  gap: ${space(1)};
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
