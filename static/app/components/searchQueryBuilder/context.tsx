import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
} from 'react';
import * as Sentry from '@sentry/react';
import {useQuery, type QueryKey} from '@tanstack/react-query';

import type {
  GetTagKeys,
  GetTagValues,
  SearchQueryBuilderProps,
} from 'sentry/components/searchQueryBuilder';
import type {CaseInsensitive} from 'sentry/components/searchQueryBuilder/hooks';
import {useFilterKeyRegistry} from 'sentry/components/searchQueryBuilder/hooks/useFilterKeyRegistry';
import {useHandleSearch} from 'sentry/components/searchQueryBuilder/hooks/useHandleSearch';
import {
  useQueryBuilderState,
  type QueryBuilderActions,
} from 'sentry/components/searchQueryBuilder/hooks/useQueryBuilderState';
import type {
  FieldDefinitionGetter,
  FilterKeySection,
  FocusOverride,
} from 'sentry/components/searchQueryBuilder/types';
import {parseQueryBuilderValue} from 'sentry/components/searchQueryBuilder/utils';
import type {ParseResult} from 'sentry/components/searchSyntax/parser';
import type {SavedSearchType, TagCollection} from 'sentry/types/group';
import {defined} from 'sentry/utils/defined';
import {getFieldDefinition as defaultGetFieldDefinition} from 'sentry/utils/fields';
import {isEmptyObject} from 'sentry/utils/object/isEmptyObject';
import {useDimensions} from 'sentry/utils/useDimensions';
import {useOrganization} from 'sentry/utils/useOrganization';
import {usePrevious} from 'sentry/utils/usePrevious';

interface SearchQueryBuilderStateContextData {
  clearSearchQuery: (options?: {reopenDropdown?: boolean}) => void;
  committedQuery: string;
  dispatch: Dispatch<QueryBuilderActions>;
  focusOverride: FocusOverride | null;
  handleSearch: (query: string) => void;
  parseQuery: (query: string) => ParseResult | null;
  parsedQuery: ParseResult | null;
  query: string;
}

interface SearchQueryBuilderConfigContextData {
  caseInsensitive: CaseInsensitive | undefined;
  disabled: boolean;
  disallowFreeText: boolean;
  disallowLogicalOperators: boolean;
  disallowNegation: boolean;
  disallowWildcard: boolean;
  filterKeyAliases: TagCollection | undefined;
  filterKeyRegistryQueryKey: QueryKey;
  filterKeySections: FilterKeySection[];
  filterKeys: TagCollection;
  getFieldDefinition: FieldDefinitionGetter;
  getSuggestedFilterKey: (key: string) => string | null;
  getTagKeys: GetTagKeys | undefined;
  getTagValues: GetTagValues;
  invalidFilterKeys: string[];
  matchKeySuggestions: Array<{key: string; valuePattern: RegExp}> | undefined;
  namespace: string | undefined;
  onCaseInsensitiveClick: ((value: CaseInsensitive) => void) | undefined;
  placeholder: string | undefined;
  recentSearches: SavedSearchType | undefined;
  replaceRawSearchKeys: string[] | undefined;
  searchSource: string;
}

interface SearchQueryBuilderLayoutContextData {
  actionBarRef: React.RefObject<HTMLDivElement | null>;
  currentInputValueRef: React.RefObject<string>;
  filterKeyMenuWidth: number;
  portalTarget: HTMLElement | null | undefined;
  size: 'small' | 'normal';
  wrapperRef: React.RefObject<HTMLDivElement | null>;
}

interface SearchQueryBuilderAIContextData {
  aiSearchBadgeType: 'alpha' | 'beta';
  askSeerNLQueryRef: React.RefObject<string | null>;
  askSeerSuggestedQueryRef: React.RefObject<string | null>;
  autoSubmitFromCurrentQuery: boolean;
  autoSubmitSeer: boolean;
  defaultToAskSeerOnFreeTextSearch: boolean;
  displayAskSeer: boolean;
  displayAskSeerFeedback: boolean;
  enableAISearch: boolean;
  setAutoSubmitFromCurrentQuery: (enabled: boolean) => void;
  setAutoSubmitSeer: (enabled: boolean) => void;
  setDisplayAskSeer: (enabled: boolean) => void;
  setDisplayAskSeerFeedback: (enabled: boolean) => void;
  skipNextSearchQueryBuilderAutoFocusRef: React.RefObject<boolean>;
}

interface SearchQueryBuilderInteractionContextData {
  consumeReopenDropdownOnQueryClear: () => void;
  reopenDropdownOnQueryClear: boolean;
}

function useRequiredContext<T>(context: React.Context<T | null>, hookName: string) {
  const contextValue = useContext(context);
  if (!contextValue) {
    throw new Error(`${hookName} must be used within a SearchQueryBuilderProvider`);
  }
  return contextValue;
}

export function useSearchQueryBuilderState() {
  return useRequiredContext(SearchQueryBuilderStateContext, 'useSearchQueryBuilderState');
}

export function useSearchQueryBuilderConfig() {
  return useRequiredContext(
    SearchQueryBuilderConfigContext,
    'useSearchQueryBuilderConfig'
  );
}

export function useSearchQueryBuilderLayout() {
  return useRequiredContext(
    SearchQueryBuilderLayoutContext,
    'useSearchQueryBuilderLayout'
  );
}

export function useSearchQueryBuilderAI() {
  return useRequiredContext(SearchQueryBuilderAIContext, 'useSearchQueryBuilderAI');
}

export function useSearchQueryBuilderInteraction() {
  return useRequiredContext(
    SearchQueryBuilderInteractionContext,
    'useSearchQueryBuilderInteraction'
  );
}

export function useHasSearchQueryBuilderProvider() {
  return useContext(SearchQueryBuilderProviderContext);
}

const defaultFieldDefinitionGetter: FieldDefinitionGetter = key =>
  defaultGetFieldDefinition(key);

const SearchQueryBuilderStateContext =
  createContext<SearchQueryBuilderStateContextData | null>(null);
const SearchQueryBuilderConfigContext =
  createContext<SearchQueryBuilderConfigContextData | null>(null);
const SearchQueryBuilderLayoutContext =
  createContext<SearchQueryBuilderLayoutContextData | null>(null);
const SearchQueryBuilderAIContext = createContext<SearchQueryBuilderAIContextData | null>(
  null
);
const SearchQueryBuilderInteractionContext =
  createContext<SearchQueryBuilderInteractionContextData | null>(null);
const SearchQueryBuilderProviderContext = createContext(false);

export function SearchQueryBuilderProvider({
  children,
  aiSearchBadgeType = 'beta',
  disabled = false,
  disallowLogicalOperators,
  disallowFreeText,
  disallowNegation,
  disallowUnsupportedFilters,
  disallowWildcard,
  defaultToAskSeerOnFreeTextSearch: defaultToAskSeerOnFreeTextSearchProp,
  enableAISearch: enableAISearchProp,
  invalidMessages,
  initialQuery,
  fieldDefinitionGetter = defaultFieldDefinitionGetter,
  filterKeys,
  filterKeyMenuWidth = 460,
  filterKeySections,
  getSuggestedFilterKey,
  getTagKeys,
  getTagValues,
  onSearch,
  placeholder,
  recentSearches,
  namespace,
  searchSource,
  getFilterTokenWarning,
  portalTarget,
  replaceRawSearchKeys,
  matchKeySuggestions,
  filterKeyAliases,
  caseInsensitive,
  onCaseInsensitiveClick,
  invalidFilterKeys,
  asyncFilterKeyRegistryQueryKey,
}: SearchQueryBuilderProps & {children: React.ReactNode}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const actionBarRef = useRef<HTMLDivElement>(null);

  const [autoSubmitFromCurrentQuery, setAutoSubmitFromCurrentQuery] = useState(false);
  const [autoSubmitSeer, setAutoSubmitSeer] = useState(false);
  const [displayAskSeerFeedback, setDisplayAskSeerFeedback] = useState(false);
  const [reopenDropdownOnQueryClear, setReopenDropdownOnQueryClear] = useState(false);
  const currentInputValueRef = useRef('');
  const askSeerNLQueryRef = useRef<string | null>(null);
  const askSeerSuggestedQueryRef = useRef<string | null>(null);
  const skipNextSearchQueryBuilderAutoFocusRef = useRef(false);

  const organization = useOrganization();
  const enableAISearch =
    Boolean(enableAISearchProp) &&
    !organization.hideAiFeatures &&
    organization.features.includes('gen-ai-features');
  const defaultToAskSeerOnFreeTextSearch =
    enableAISearch &&
    Boolean(defaultToAskSeerOnFreeTextSearchProp) &&
    organization.features.includes('gen-ai-default-to-ask-seer');

  const [displayAskSeerState, setDisplayAskSeerState] = useState(false);
  const displayAskSeer = enableAISearch ? displayAskSeerState : false;

  const {filterKeyRegistryQueryOptions, registerFilterKeys} = useFilterKeyRegistry({
    asyncFilterKeyRegistryQueryKey,
  });

  const {data: asyncFilterKeys = {}} = useQuery(filterKeyRegistryQueryOptions);

  const registeredGetTagKeys = useCallback<GetTagKeys>(
    async searchQuery => {
      if (!getTagKeys) {
        return [];
      }

      const registryQueryKey = filterKeyRegistryQueryOptions.queryKey;
      const tags = await getTagKeys(searchQuery);
      registerFilterKeys(tags, registryQueryKey);
      return tags;
    },
    [filterKeyRegistryQueryOptions.queryKey, getTagKeys, registerFilterKeys]
  );

  const mergedFilterKeys = useMemo(() => {
    if (isEmptyObject(asyncFilterKeys)) {
      return filterKeys;
    }

    return {...asyncFilterKeys, ...filterKeys};
  }, [asyncFilterKeys, filterKeys]);

  const getFieldDefinitionWithTagMetadata = useCallback<FieldDefinitionGetter>(
    (key, options) =>
      fieldDefinitionGetter(key, {
        ...options,
        kind: options?.kind ?? mergedFilterKeys[key]?.kind,
      }),
    [mergedFilterKeys, fieldDefinitionGetter]
  );

  const stableGetSuggestedFilterKey = useCallback(
    (key: string) => {
      return getSuggestedFilterKey ? getSuggestedFilterKey(key) : null;
    },
    [getSuggestedFilterKey]
  );

  const stableInvalidFilterKeys = useMemo(
    () => invalidFilterKeys ?? [],
    [invalidFilterKeys]
  );

  const parseQuery = useCallback(
    (query: string) =>
      parseQueryBuilderValue(query, getFieldDefinitionWithTagMetadata, {
        getFilterTokenWarning,
        disallowFreeText,
        disallowLogicalOperators,
        disallowNegation,
        disallowUnsupportedFilters,
        disallowWildcard,
        filterKeys: mergedFilterKeys,
        invalidMessages,
        invalidFilterKeys: stableInvalidFilterKeys,
        filterKeyAliases,
      }),
    [
      disallowFreeText,
      disallowLogicalOperators,
      disallowNegation,
      disallowUnsupportedFilters,
      disallowWildcard,
      getFieldDefinitionWithTagMetadata,
      mergedFilterKeys,
      getFilterTokenWarning,
      invalidMessages,
      stableInvalidFilterKeys,
      filterKeyAliases,
    ]
  );

  const {state, dispatch} = useQueryBuilderState({
    initialQuery,
    getFieldDefinition: getFieldDefinitionWithTagMetadata,
    disabled,
    displayAskSeerFeedback,
    setDisplayAskSeerFeedback,
    replaceRawSearchKeys,
    parseQuery,
    searchSource,
  });

  const parsedQuery = useMemo(() => parseQuery(state.query), [parseQuery, state.query]);

  const previousQuery = usePrevious(state.query);
  const firstRender = useRef(true);
  useEffect(() => {
    // on the first render, we want to check the currently parsed query,
    // then on subsequent renders, we want to ensure the parsedQuery hasnt changed
    if (!firstRender.current && state.query === previousQuery) {
      return;
    }
    firstRender.current = false;

    const warnings = parsedQuery?.filter(
      token => 'warning' in token && defined(token.warning)
    )?.length;
    if (warnings) {
      Sentry.metrics.distribution('search-query-builder.token.warnings', warnings, {
        attributes: {searchSource},
      });
    }

    const invalids = parsedQuery?.filter(
      token => 'invalid' in token && defined(token.invalid)
    )?.length;
    if (invalids) {
      Sentry.metrics.distribution('search-query-builder.token.invalids', invalids, {
        attributes: {searchSource},
      });
    }
  }, [parsedQuery, state.query, previousQuery, searchSource]);

  const handleSearch = useHandleSearch({
    parsedQuery,
    recentSearches,
    namespace,
    searchSource,
    onSearch,
  });

  const clearSearchQuery = useCallback(
    ({reopenDropdown = false}: {reopenDropdown?: boolean} = {}) => {
      currentInputValueRef.current = '';
      askSeerNLQueryRef.current = null;
      askSeerSuggestedQueryRef.current = null;
      setDisplayAskSeerFeedback(false);
      setReopenDropdownOnQueryClear(reopenDropdown);
      dispatch({type: 'CLEAR'});
      handleSearch('');
    },
    [dispatch, handleSearch]
  );

  const consumeReopenDropdownOnQueryClear = useCallback(() => {
    setReopenDropdownOnQueryClear(false);
  }, []);

  const {width: searchBarWidth} = useDimensions({elementRef: wrapperRef});
  const size =
    searchBarWidth && searchBarWidth < 600 ? ('small' as const) : ('normal' as const);

  const stateValue = useMemo((): SearchQueryBuilderStateContextData => {
    return {
      clearSearchQuery,
      committedQuery: state.committedQuery,
      dispatch,
      focusOverride: state.focusOverride,
      handleSearch,
      parseQuery,
      parsedQuery,
      query: state.query,
    };
  }, [
    clearSearchQuery,
    dispatch,
    handleSearch,
    parseQuery,
    parsedQuery,
    state.committedQuery,
    state.focusOverride,
    state.query,
  ]);

  const configValue = useMemo((): SearchQueryBuilderConfigContextData => {
    return {
      caseInsensitive,
      disabled,
      disallowFreeText: Boolean(disallowFreeText),
      disallowLogicalOperators: Boolean(disallowLogicalOperators),
      disallowNegation: Boolean(disallowNegation),
      disallowWildcard: Boolean(disallowWildcard),
      filterKeyAliases,
      filterKeyRegistryQueryKey: filterKeyRegistryQueryOptions.queryKey,
      filterKeySections: filterKeySections ?? [],
      filterKeys: mergedFilterKeys,
      getFieldDefinition: getFieldDefinitionWithTagMetadata,
      getSuggestedFilterKey: stableGetSuggestedFilterKey,
      getTagKeys: getTagKeys ? registeredGetTagKeys : undefined,
      getTagValues,
      invalidFilterKeys: stableInvalidFilterKeys,
      matchKeySuggestions,
      namespace,
      onCaseInsensitiveClick,
      placeholder,
      recentSearches,
      replaceRawSearchKeys,
      searchSource,
    };
  }, [
    caseInsensitive,
    disabled,
    disallowFreeText,
    disallowLogicalOperators,
    disallowNegation,
    disallowWildcard,
    filterKeyAliases,
    filterKeyRegistryQueryOptions.queryKey,
    filterKeySections,
    getTagKeys,
    registeredGetTagKeys,
    getTagValues,
    stableInvalidFilterKeys,
    matchKeySuggestions,
    namespace,
    onCaseInsensitiveClick,
    placeholder,
    recentSearches,
    replaceRawSearchKeys,
    searchSource,
    mergedFilterKeys,
    getFieldDefinitionWithTagMetadata,
    stableGetSuggestedFilterKey,
  ]);

  const layoutValue = useMemo((): SearchQueryBuilderLayoutContextData => {
    return {
      actionBarRef,
      currentInputValueRef,
      filterKeyMenuWidth,
      portalTarget,
      size,
      wrapperRef,
    };
  }, [
    actionBarRef,
    currentInputValueRef,
    filterKeyMenuWidth,
    portalTarget,
    size,
    wrapperRef,
  ]);

  const aiValue = useMemo((): SearchQueryBuilderAIContextData => {
    return {
      aiSearchBadgeType,
      askSeerNLQueryRef,
      askSeerSuggestedQueryRef,
      autoSubmitFromCurrentQuery,
      autoSubmitSeer,
      defaultToAskSeerOnFreeTextSearch,
      displayAskSeer,
      displayAskSeerFeedback,
      enableAISearch,
      setAutoSubmitFromCurrentQuery,
      setAutoSubmitSeer,
      setDisplayAskSeer: setDisplayAskSeerState,
      setDisplayAskSeerFeedback,
      skipNextSearchQueryBuilderAutoFocusRef,
    };
  }, [
    aiSearchBadgeType,
    askSeerNLQueryRef,
    askSeerSuggestedQueryRef,
    autoSubmitFromCurrentQuery,
    autoSubmitSeer,
    defaultToAskSeerOnFreeTextSearch,
    displayAskSeer,
    displayAskSeerFeedback,
    enableAISearch,
    setDisplayAskSeerFeedback,
    skipNextSearchQueryBuilderAutoFocusRef,
  ]);

  const interactionValue = useMemo((): SearchQueryBuilderInteractionContextData => {
    return {
      consumeReopenDropdownOnQueryClear,
      reopenDropdownOnQueryClear,
    };
  }, [consumeReopenDropdownOnQueryClear, reopenDropdownOnQueryClear]);

  return (
    <SearchQueryBuilderProviderContext.Provider value>
      <SearchQueryBuilderConfigContext.Provider value={configValue}>
        <SearchQueryBuilderStateContext.Provider value={stateValue}>
          <SearchQueryBuilderLayoutContext.Provider value={layoutValue}>
            <SearchQueryBuilderAIContext.Provider value={aiValue}>
              <SearchQueryBuilderInteractionContext.Provider value={interactionValue}>
                {children}
              </SearchQueryBuilderInteractionContext.Provider>
            </SearchQueryBuilderAIContext.Provider>
          </SearchQueryBuilderLayoutContext.Provider>
        </SearchQueryBuilderStateContext.Provider>
      </SearchQueryBuilderConfigContext.Provider>
    </SearchQueryBuilderProviderContext.Provider>
  );
}
