import {createContext, type Dispatch, useContext, useMemo, useRef} from 'react';

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
  filterKeyMenuWidth: number;
  filterKeySections: FilterKeySection[];
  filterKeys: TagCollection;
  focusOverride: FocusOverride | null;
  getFieldDefinition: (key: string, kind?: FieldKind) => FieldDefinition | null;
  getTagValues: (tag: Tag, query: string) => Promise<string[]>;
  handleOnChange: (query: string) => void;
  handleSearch: (query: string) => void;
  parsedQuery: ParseResult | null;
  query: string;
  searchSource: string;
  size: 'small' | 'normal';
  wrapperRef: React.RefObject<HTMLDivElement | null>;
  placeholder?: string;
  /**
   * The element to render the combobox popovers into.
   */
  portalTarget?: HTMLElement | null;
  recentSearches?: SavedSearchType;
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
  getTagValues,
  onChange,
  onSearch,
  placeholder,
  recentSearches,
  searchSource,
  getFilterTokenWarning,
  portalTarget,
}: SearchQueryBuilderProps & {children: React.ReactNode}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const actionBarRef = useRef<HTMLDivElement>(null);
  const {state, dispatch} = useQueryBuilderState({
    initialQuery,
    getFieldDefinition: fieldDefinitionGetter,
    disabled,
  });

  const parsedQuery = useMemo(
    () =>
      parseQueryBuilderValue(state.query, fieldDefinitionGetter, {
        getFilterTokenWarning,
        disallowFreeText,
        disallowLogicalOperators,
        disallowUnsupportedFilters,
        disallowWildcard,
        filterKeys,
        invalidMessages,
      }),
    [
      state.query,
      fieldDefinitionGetter,
      disallowFreeText,
      disallowLogicalOperators,
      disallowUnsupportedFilters,
      disallowWildcard,
      filterKeys,
      invalidMessages,
      getFilterTokenWarning,
    ]
  );

  const handleSearch = useHandleSearch({
    parsedQuery,
    recentSearches,
    searchSource,
    onSearch,
    trigger: 'onsearch',
  });
  const handleOnChange = useHandleSearch({
    parsedQuery,
    recentSearches,
    searchSource,
    onSearch: onChange,
    trigger: 'onchange',
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
      parsedQuery,
      filterKeySections: filterKeySections ?? [],
      filterKeyMenuWidth,
      filterKeys,
      getTagValues,
      getFieldDefinition: fieldDefinitionGetter,
      dispatch,
      wrapperRef,
      actionBarRef,
      handleSearch,
      handleOnChange,
      placeholder,
      recentSearches,
      searchSource,
      size,
      portalTarget,
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
    getTagValues,
    fieldDefinitionGetter,
    dispatch,
    handleSearch,
    handleOnChange,
    placeholder,
    recentSearches,
    searchSource,
    size,
    portalTarget,
  ]);

  return (
    <SearchQueryBuilderContext.Provider value={contextValue}>
      {children}
    </SearchQueryBuilderContext.Provider>
  );
}
