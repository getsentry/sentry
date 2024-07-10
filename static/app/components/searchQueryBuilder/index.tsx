import {useMemo, useRef} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {inputStyles} from 'sentry/components/input';
import {
  SearchQueryBuilerContext,
  useSearchQueryBuilder,
} from 'sentry/components/searchQueryBuilder/context';
import {PlainTextQueryInput} from 'sentry/components/searchQueryBuilder/plainTextQueryInput';
import {TokenizedQueryGrid} from 'sentry/components/searchQueryBuilder/tokenizedQueryGrid';
import {
  type FilterKeySection,
  QueryInterfaceType,
} from 'sentry/components/searchQueryBuilder/types';
import {useHandleSearch} from 'sentry/components/searchQueryBuilder/useHandleSearch';
import {useQueryBuilderState} from 'sentry/components/searchQueryBuilder/useQueryBuilderState';
import {parseQueryBuilderValue} from 'sentry/components/searchQueryBuilder/utils';
import {IconClose, IconSearch} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {SavedSearchType, Tag, TagCollection} from 'sentry/types/group';
import PanelProvider from 'sentry/utils/panelProvider';
import {useDimensions} from 'sentry/utils/useDimensions';
import {useEffectAfterFirstRender} from 'sentry/utils/useEffectAfterFirstRender';

interface SearchQueryBuilderProps {
  /**
   * A complete mapping of all possible filter keys.
   * Filter keys not included will not show up when typing and may be shown as invalid.
   * Should be a stable reference.
   */
  filterKeys: TagCollection;
  getTagValues: (key: Tag, query: string) => Promise<string[]>;
  initialQuery: string;
  /**
   * Indicates the usage of the search bar for analytics
   */
  searchSource: string;
  className?: string;
  /**
   * When provided, displays a tabbed interface for discovering filter keys.
   * Sections and filter keys are displayed in the order they are provided.
   */
  filterKeySections?: FilterKeySection[];
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
  savedSearchType?: SavedSearchType;
}

function ActionButtons() {
  const {dispatch, handleSearch} = useSearchQueryBuilder();

  return (
    <ButtonsWrapper>
      <ActionButton
        aria-label={t('Clear search query')}
        size="zero"
        icon={<IconClose />}
        borderless
        onClick={() => {
          dispatch({type: 'CLEAR'});
          handleSearch('');
        }}
      />
    </ButtonsWrapper>
  );
}

export function SearchQueryBuilder({
  className,
  label,
  initialQuery,
  filterKeys,
  filterKeySections,
  getTagValues,
  onChange,
  onSearch,
  onBlur,
  searchSource,
  savedSearchType,
  queryInterface = QueryInterfaceType.TOKENIZED,
}: SearchQueryBuilderProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const {state, dispatch} = useQueryBuilderState({initialQuery});

  const parsedQuery = useMemo(
    () => parseQueryBuilderValue(state.query, {filterKeys}),
    [filterKeys, state.query]
  );

  useEffectAfterFirstRender(() => {
    dispatch({type: 'UPDATE_QUERY', query: initialQuery});
  }, [dispatch, initialQuery]);

  useEffectAfterFirstRender(() => {
    onChange?.(state.query);
  }, [onChange, state.query]);

  const handleSearch = useHandleSearch({
    parsedQuery,
    savedSearchType,
    searchSource,
    onSearch,
  });
  const {width} = useDimensions({elementRef: wrapperRef});
  const size = width < 600 ? ('small' as const) : ('normal' as const);

  const contextValue = useMemo(() => {
    return {
      ...state,
      parsedQuery,
      filterKeySections: filterKeySections ?? [],
      filterKeys,
      getTagValues,
      dispatch,
      onSearch,
      wrapperRef,
      handleSearch,
      searchSource,
      size,
    };
  }, [
    state,
    parsedQuery,
    filterKeySections,
    filterKeys,
    getTagValues,
    dispatch,
    onSearch,
    handleSearch,
    searchSource,
    size,
  ]);

  return (
    <SearchQueryBuilerContext.Provider value={contextValue}>
      <PanelProvider>
        <Wrapper
          className={className}
          onBlur={() => onBlur?.(state.query)}
          ref={wrapperRef}
        >
          {size !== 'small' && <PositionedSearchIcon size="sm" />}
          {!parsedQuery || queryInterface === QueryInterfaceType.TEXT ? (
            <PlainTextQueryInput label={label} />
          ) : (
            <TokenizedQueryGrid label={label} />
          )}
          {size !== 'small' && <ActionButtons />}
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
