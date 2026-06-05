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

import type {
  GetTagKeys,
  GetTagValues,
  SearchQueryBuilderProps,
} from 'sentry/components/searchQueryBuilder';
import type {CaseInsensitive} from 'sentry/components/searchQueryBuilder/hooks';
import {useHandleSearch} from 'sentry/components/searchQueryBuilder/hooks/useHandleSearch';
import {
  useQueryBuilderState,
  type QueryBuilderActions,
} from 'sentry/components/searchQueryBuilder/hooks/useQueryBuilderState';
import type {
  FilterKeySection,
  FocusOverride,
} from 'sentry/components/searchQueryBuilder/types';
import {parseQueryBuilderValue} from 'sentry/components/searchQueryBuilder/utils';
import type {ParseResult} from 'sentry/components/searchSyntax/parser';
import type {SavedSearchType, TagCollection} from 'sentry/types/group';
import {defined} from 'sentry/utils/defined';
import type {FieldDefinition, FieldKind} from 'sentry/utils/fields';
import {getFieldDefinition} from 'sentry/utils/fields';
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
  disallowWildcard: boolean;
  filterKeyAliases: TagCollection | undefined;
  filterKeySections: FilterKeySection[];
  filterKeys: TagCollection;
  getFieldDefinition: (key: string, kind?: FieldKind) => FieldDefinition | null;
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
  autoSubmitSeer: boolean;
  displayAskSeer: boolean;
  displayAskSeerFeedback: boolean;
  enableAISearch: boolean;
  setAutoSubmitSeer: (enabled: boolean) => void;
  setDisplayAskSeer: (enabled: boolean) => void;
  setDisplayAskSeerFeedback: (enabled: boolean) => void;
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
  disallowUnsupportedFilters,
  disallowWildcard,
  enableAISearch: enableAISearchProp,
  invalidMessages,
  initialQuery,
  fieldDefinitionGetter = getFieldDefinition,
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
}: SearchQueryBuilderProps & {children: React.ReactNode}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const actionBarRef = useRef<HTMLDivElement>(null);

  const [autoSubmitSeer, setAutoSubmitSeer] = useState(false);
  const [displayAskSeerFeedback, setDisplayAskSeerFeedback] = useState(false);
  const [reopenDropdownOnQueryClear, setReopenDropdownOnQueryClear] = useState(false);
  const currentInputValueRef = useRef('');
  const askSeerNLQueryRef = useRef<string | null>(null);
  const askSeerSuggestedQueryRef = useRef<string | null>(null);

  const organization = useOrganization();
  const enableAISearch =
    Boolean(enableAISearchProp) &&
    !organization.hideAiFeatures &&
    organization.features.includes('gen-ai-features');

  const [displayAskSeerState, setDisplayAskSeerState] = useState(false);
  const displayAskSeer = enableAISearch ? displayAskSeerState : false;

  const stableFieldDefinitionGetter = useMemo(
    () => fieldDefinitionGetter,
    [fieldDefinitionGetter]
  );

  const stableFilterKeys = useMemo(() => filterKeys, [filterKeys]);

  const stableGetSuggestedFilterKey = useCallback(
    (key: string) => {
      return getSuggestedFilterKey ? getSuggestedFilterKey(key) : key;
    },
    [getSuggestedFilterKey]
  );

  const parseQuery = useCallback(
    (query: string) =>
      parseQueryBuilderValue(query, stableFieldDefinitionGetter, {
        getFilterTokenWarning,
        disallowFreeText,
        disallowLogicalOperators,
        disallowUnsupportedFilters,
        disallowWildcard,
        filterKeys: stableFilterKeys,
        invalidMessages,
        filterKeyAliases,
      }),
    [
      disallowFreeText,
      disallowLogicalOperators,
      disallowUnsupportedFilters,
      disallowWildcard,
      stableFieldDefinitionGetter,
      stableFilterKeys,
      getFilterTokenWarning,
      invalidMessages,
      filterKeyAliases,
    ]
  );

  const {state, dispatch} = useQueryBuilderState({
    initialQuery,
    getFieldDefinition: fieldDefinitionGetter,
    disabled,
    displayAskSeerFeedback,
    setDisplayAskSeerFeedback,
    replaceRawSearchKeys,
    parseQuery,
  });

  const parsedQuery = useMemo(() => parseQuery(state.query), [parseQuery, state.query]);

  const stableInvalidFilterKeys = useMemo(
    () => invalidFilterKeys ?? [],
    [invalidFilterKeys]
  );

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
      disallowWildcard: Boolean(disallowWildcard),
      filterKeyAliases,
      filterKeySections: filterKeySections ?? [],
      filterKeys: stableFilterKeys,
      getFieldDefinition: stableFieldDefinitionGetter,
      getSuggestedFilterKey: stableGetSuggestedFilterKey,
      getTagKeys,
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
    disallowWildcard,
    filterKeyAliases,
    filterKeySections,
    getTagKeys,
    getTagValues,
    stableInvalidFilterKeys,
    matchKeySuggestions,
    namespace,
    onCaseInsensitiveClick,
    placeholder,
    recentSearches,
    replaceRawSearchKeys,
    searchSource,
    stableFieldDefinitionGetter,
    stableFilterKeys,
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
      autoSubmitSeer,
      displayAskSeer,
      displayAskSeerFeedback,
      enableAISearch,
      setAutoSubmitSeer,
      setDisplayAskSeer: setDisplayAskSeerState,
      setDisplayAskSeerFeedback,
    };
  }, [
    aiSearchBadgeType,
    askSeerNLQueryRef,
    askSeerSuggestedQueryRef,
    autoSubmitSeer,
    displayAskSeer,
    displayAskSeerFeedback,
    enableAISearch,
    setDisplayAskSeerFeedback,
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
