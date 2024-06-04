import {useMemo} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {inputStyles} from 'sentry/components/input';
import {
  SearchQueryBuilerContext,
  useSearchQueryBuilder,
} from 'sentry/components/searchQueryBuilder/context';
import {PlainTextQueryInput} from 'sentry/components/searchQueryBuilder/plainTextQueryInput';
import {TokenizedQueryGrid} from 'sentry/components/searchQueryBuilder/tokenizedQueryGrid';
import {QueryInterfaceType} from 'sentry/components/searchQueryBuilder/types';
import {useQueryBuilderState} from 'sentry/components/searchQueryBuilder/useQueryBuilderState';
import {collapseTextTokens} from 'sentry/components/searchQueryBuilder/utils';
import {parseSearch} from 'sentry/components/searchSyntax/parser';
import {IconClose, IconSearch} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Tag, TagCollection} from 'sentry/types';
import PanelProvider from 'sentry/utils/panelProvider';
import {useEffectAfterFirstRender} from 'sentry/utils/useEffectAfterFirstRender';

interface SearchQueryBuilderProps {
  getTagValues: (key: Tag, query: string) => Promise<string[]>;
  initialQuery: string;
  supportedKeys: TagCollection;
  className?: string;
  label?: string;
  onBlur?: (query: string) => void;
  /**
   * Called when the query value changes
   */
  onChange?: (query: string) => void;
  /**
   * Called when the user presses enter
   */
  onSearch?: (query: string) => void;
  queryInterface?: QueryInterfaceType;
}

function ActionButtons() {
  const {dispatch} = useSearchQueryBuilder();

  return (
    <ButtonsWrapper>
      <ActionButton
        aria-label={t('Clear search query')}
        size="zero"
        icon={<IconClose />}
        borderless
        onClick={() => dispatch({type: 'CLEAR'})}
      />
    </ButtonsWrapper>
  );
}

export function SearchQueryBuilder({
  className,
  label,
  initialQuery,
  supportedKeys,
  getTagValues,
  onChange,
  onSearch,
  onBlur,
  queryInterface = QueryInterfaceType.TOKENIZED,
}: SearchQueryBuilderProps) {
  const {state, dispatch} = useQueryBuilderState({initialQuery});

  const parsedQuery = useMemo(
    () => collapseTextTokens(parseSearch(state.query || ' ', {flattenParenGroups: true})),
    [state.query]
  );

  useEffectAfterFirstRender(() => {
    dispatch({type: 'UPDATE_QUERY', query: initialQuery});
  }, [dispatch, initialQuery]);

  useEffectAfterFirstRender(() => {
    onChange?.(state.query);
  }, [onChange, state.query]);

  const contextValue = useMemo(() => {
    return {
      ...state,
      parsedQuery,
      keys: supportedKeys,
      getTagValues,
      dispatch,
      onSearch,
    };
  }, [state, parsedQuery, supportedKeys, getTagValues, dispatch, onSearch]);

  return (
    <SearchQueryBuilerContext.Provider value={contextValue}>
      <PanelProvider>
        <Wrapper className={className} onBlur={() => onBlur?.(state.query)}>
          <PositionedSearchIcon size="sm" />
          {!parsedQuery || queryInterface === QueryInterfaceType.TEXT ? (
            <PlainTextQueryInput label={label} />
          ) : (
            <TokenizedQueryGrid label={label} />
          )}
          <ActionButtons />
        </Wrapper>
      </PanelProvider>
    </SearchQueryBuilerContext.Provider>
  );
}

const Wrapper = styled('div')`
  ${inputStyles}
  min-height: 38px;
  padding: 0;
  height: auto;
  width: 100%;
  position: relative;
  font-size: ${p => p.theme.fontSizeMedium};
  cursor: text;

  :focus-within {
    border: 1px solid ${p => p.theme.focusBorder};
    box-shadow: 0 0 0 1px ${p => p.theme.focusBorder};
  }
`;

const ButtonsWrapper = styled('div')`
  position: absolute;
  right: 9px;
  top: 9px;
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
`;

const ActionButton = styled(Button)`
  color: ${p => p.theme.subText};
`;

const PositionedSearchIcon = styled(IconSearch)`
  color: ${p => p.theme.subText};
  position: absolute;
  left: ${space(1.5)};
  top: ${space(0.75)};
  height: 22px;
`;
