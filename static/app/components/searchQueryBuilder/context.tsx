import {
  createContext,
  type Dispatch,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';

import type {SearchQueryBuilderProps} from 'sentry/components/searchQueryBuilder';
import {useHandleSearch} from 'sentry/components/searchQueryBuilder/hooks/useHandleSearch';
import {
  type QueryBuilderActions,
  useQueryBuilderState,
} from 'sentry/components/searchQueryBuilder/hooks/useQueryBuilderState';
import type {
  FilterKeySection,
  FocusOverride,
} from 'sentry/components/searchQueryBuilder/types';
import {parseQueryBuilderValue} from 'sentry/components/searchQueryBuilder/utils';
import type {ParseResult} from 'sentry/components/searchSyntax/parser';
import type {SavedSearchType, Tag, TagCollection} from 'sentry/types/group';
import type {FieldDefinition, FieldKind} from 'sentry/utils/fields';
import {getFieldDefinition} from 'sentry/utils/fields';
import {useDimensions} from 'sentry/utils/useDimensions';

interface SearchQueryBuilderContextData {
  actionBarRef: React.RefObject<HTMLDivElement | null>;
  committedQuery: string;
  disabled: boolean;
  disallowFreeText: boolean;
  disallowWildcard: boolean;
  dispatch: Dispatch<QueryBuilderActions>;
  displaySeerResults: boolean;
  filterKeyMenuWidth: number;
  filterKeySections: FilterKeySection[];
  filterKeys: TagCollection;
  focusOverride: FocusOverride | null;
  getFieldDefinition: (key: string, kind?: FieldKind) => FieldDefinition | null;
  getSuggestedFilterKey: (key: string) => string | null;
  getTagValues: (tag: Tag, query: string) => Promise<string[]>;
  handleSearch: (query: string) => void;
  parseQuery: (query: string) => ParseResult | null;
  parsedQuery: ParseResult | null;
  query: string;
  searchSource: string;
  setDisplaySeerResults: (enabled: boolean) => void;
  size: 'small' | 'normal';
  wrapperRef: React.RefObject<HTMLDivElement | null>;
  placeholder?: string;
  /**
   * The element to render the combobox popovers into.
   */
  portalTarget?: HTMLElement | null;
  recentSearches?: SavedSearchType;
  replaceRawSearchKeys?: string[];
}

export function useSearchQueryBuilder() {
  const context = useContext(SearchQueryBuilderContext);
  if (!context) {
    throw new Error(
      'useSearchQueryBuilder must be used within a SearchQueryBuilderProvider'
    );
  }
  return context;
}

export const SearchQueryBuilderContext =
  createContext<SearchQueryBuilderContextData | null>(null);

export function SearchQueryBuilderProvider({
  children,
  disabled = false,
  disallowLogicalOperators,
  disallowFreeText,
  disallowUnsupportedFilters,
  disallowWildcard,
  invalidMessages,
  initialQuery,
  fieldDefinitionGetter = getFieldDefinition,
  filterKeys,
  filterKeyMenuWidth = 360,
  filterKeySections,
  getSuggestedFilterKey,
  getTagValues,
  onSearch,
  placeholder,
  recentSearches,
  searchSource,
  getFilterTokenWarning,
  portalTarget,
  replaceRawSearchKeys,
}: SearchQueryBuilderProps & {children: React.ReactNode}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const actionBarRef = useRef<HTMLDivElement>(null);
  const [displaySeerResults, setDisplaySeerResults] = useState(false);
  const {state, dispatch} = useQueryBuilderState({
    initialQuery,
    getFieldDefinition: fieldDefinitionGetter,
    disabled,
  });

  const parseQuery = useCallback(
    (query: string) =>
      parseQueryBuilderValue(query, fieldDefinitionGetter, {
        getFilterTokenWarning,
        disallowFreeText,
        disallowLogicalOperators,
        disallowUnsupportedFilters,
        disallowWildcard,
        filterKeys,
        invalidMessages,
      }),
    [
      disallowFreeText,
      disallowLogicalOperators,
      disallowUnsupportedFilters,
      disallowWildcard,
      fieldDefinitionGetter,
      filterKeys,
      getFilterTokenWarning,
      invalidMessages,
    ]
  );
  const parsedQuery = useMemo(() => parseQuery(state.query), [parseQuery, state.query]);

  const handleSearch = useHandleSearch({
    parsedQuery,
    recentSearches,
    searchSource,
    onSearch,
  });
  const {width: searchBarWidth} = useDimensions({elementRef: wrapperRef});
  const size =
    searchBarWidth && searchBarWidth < 600 ? ('small' as const) : ('normal' as const);

  const contextValue = useMemo((): SearchQueryBuilderContextData => {
    return {
      ...state,
      disabled,
      disallowFreeText: Boolean(disallowFreeText),
      disallowWildcard: Boolean(disallowWildcard),
      parseQuery,
      parsedQuery,
      filterKeySections: filterKeySections ?? [],
      filterKeyMenuWidth,
      filterKeys,
      getSuggestedFilterKey: getSuggestedFilterKey ?? ((key: string) => key),
      getTagValues,
      getFieldDefinition: fieldDefinitionGetter,
      dispatch,
      wrapperRef,
      actionBarRef,
      handleSearch,
      placeholder,
      recentSearches,
      searchSource,
      size,
      portalTarget,
      displaySeerResults,
      setDisplaySeerResults,
      replaceRawSearchKeys,
    };
  }, [
    state,
    disabled,
    disallowFreeText,
    disallowWildcard,
    parsedQuery,
    filterKeySections,
    filterKeyMenuWidth,
    filterKeys,
    getSuggestedFilterKey,
    getTagValues,
    fieldDefinitionGetter,
    dispatch,
    handleSearch,
    placeholder,
    recentSearches,
    searchSource,
    size,
    portalTarget,
    parseQuery,
    displaySeerResults,
    setDisplaySeerResults,
    replaceRawSearchKeys,
  ]);

  return (
    <SearchQueryBuilderContext.Provider value={contextValue}>
      {children}
    </SearchQueryBuilderContext.Provider>
  );
}
