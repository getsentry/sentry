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
import {defined} from 'sentry/utils';
import type {FieldDefinition, FieldKind} from 'sentry/utils/fields';
import {getFieldDefinition} from 'sentry/utils/fields';
import {useLLMContext, type LLMAction} from 'sentry/utils/seer/llmContext';
import {useDimensions} from 'sentry/utils/useDimensions';
import useOrganization from 'sentry/utils/useOrganization';
import usePrevious from 'sentry/utils/usePrevious';

interface SearchQueryBuilderContextData {
  actionBarRef: React.RefObject<HTMLDivElement | null>;
  aiSearchBadgeType: 'alpha' | 'beta';
  askSeerNLQueryRef: React.RefObject<string | null>;
  askSeerSuggestedQueryRef: React.RefObject<string | null>;
  autoSubmitSeer: boolean;
  committedQuery: string;
  currentInputValueRef: React.RefObject<string>;
  disabled: boolean;
  disallowFreeText: boolean;
  disallowLogicalOperators: boolean;
  disallowWildcard: boolean;
  dispatch: Dispatch<QueryBuilderActions>;
  displayAskSeer: boolean;
  displayAskSeerFeedback: boolean;
  enableAISearch: boolean;
  filterKeyMenuWidth: number;
  filterKeySections: FilterKeySection[];
  filterKeys: TagCollection;
  focusOverride: FocusOverride | null;
  // @deprecated: remove this, it's constant now
  gaveSeerConsent: true;
  getFieldDefinition: (key: string, kind?: FieldKind) => FieldDefinition | null;
  getSuggestedFilterKey: (key: string) => string | null;
  getTagValues: GetTagValues;
  handleSearch: (query: string) => void;
  llmContextRef: React.RefObject<HTMLElement | null>;
  parseQuery: (query: string) => ParseResult | null;
  parsedQuery: ParseResult | null;
  query: string;
  searchSource: string;
  setAutoSubmitSeer: (enabled: boolean) => void;
  setDisplayAskSeer: (enabled: boolean) => void;
  setDisplayAskSeerFeedback: (enabled: boolean) => void;
  size: 'small' | 'normal';
  wrapperRef: React.RefObject<HTMLDivElement | null>;
  caseInsensitive?: CaseInsensitive;
  filterKeyAliases?: TagCollection;
  getTagKeys?: GetTagKeys;
  matchKeySuggestions?: Array<{key: string; valuePattern: RegExp}>;
  namespace?: string;
  onCaseInsensitiveClick?: (value: CaseInsensitive) => void;
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
}: SearchQueryBuilderProps & {children: React.ReactNode}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const actionBarRef = useRef<HTMLDivElement>(null);

  const [autoSubmitSeer, setAutoSubmitSeer] = useState(false);
  const [displayAskSeerFeedback, setDisplayAskSeerFeedback] = useState(false);
  const currentInputValueRef = useRef<string>('');
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
  const {width: searchBarWidth} = useDimensions({elementRef: wrapperRef});
  const size =
    searchBarWidth && searchBarWidth < 600 ? ('small' as const) : ('normal' as const);

  const contextValue = useMemo((): SearchQueryBuilderContextData => {
    return {
      ...state,
      aiSearchBadgeType,
      disabled,
      disallowFreeText: Boolean(disallowFreeText),
      disallowLogicalOperators: Boolean(disallowLogicalOperators),
      disallowWildcard: Boolean(disallowWildcard),
      enableAISearch,
      parseQuery,
      parsedQuery,
      filterKeySections: filterKeySections ?? [],
      filterKeyMenuWidth,
      filterKeys: stableFilterKeys,
      getSuggestedFilterKey: stableGetSuggestedFilterKey,
      getTagValues,
      getTagKeys,
      getFieldDefinition: stableFieldDefinitionGetter,
      dispatch,
      wrapperRef,
      llmContextRef,
      actionBarRef,
      handleSearch,
      placeholder,
      recentSearches,
      namespace,
      searchSource,
      size,
      portalTarget,
      autoSubmitSeer,
      setAutoSubmitSeer,
      displayAskSeer,
      setDisplayAskSeer: setDisplayAskSeerState,
      replaceRawSearchKeys,
      matchKeySuggestions,
      filterKeyAliases,
      gaveSeerConsent: true,
      currentInputValueRef,
      displayAskSeerFeedback,
      setDisplayAskSeerFeedback,
      askSeerNLQueryRef,
      askSeerSuggestedQueryRef,
      caseInsensitive,
      onCaseInsensitiveClick,
    };
  }, [
    aiSearchBadgeType,
    autoSubmitSeer,
    caseInsensitive,
    disabled,
    disallowFreeText,
    disallowLogicalOperators,
    disallowWildcard,
    dispatch,
    displayAskSeer,
    displayAskSeerFeedback,
    enableAISearch,
    filterKeyAliases,
    filterKeyMenuWidth,
    filterKeySections,
    getTagKeys,
    getTagValues,
    handleSearch,
    llmContextRef,
    matchKeySuggestions,
    onCaseInsensitiveClick,
    parseQuery,
    parsedQuery,
    placeholder,
    portalTarget,
    recentSearches,
    namespace,
    replaceRawSearchKeys,
    searchSource,
    size,
    stableFieldDefinitionGetter,
    stableFilterKeys,
    stableGetSuggestedFilterKey,
    state,
  ]);

  // ---- LLM Context ----
  // Use ref to track latest query for LLM handlers to avoid stale closures
  const queryRef = useRef(state.query);

  useEffect(() => {
    queryRef.current = state.query;
  }, [state.query]);

  const llmData = useMemo(
    () => ({
      query: state.query,
      parsedQuery: parsedQuery?.map(token => ({
        type: token.type,
        text: token.text,
      })),
      availableFilters: Object.keys(stableFilterKeys),
    }),
    [state.query, parsedQuery, stableFilterKeys]
  );

  const llmActions = useMemo<LLMAction[]>(
    () => [
      {
        type: 'setQuery',
        description:
          'Replace the entire search query with a new query string. Use the Sentry search syntax (e.g., "status:unresolved level:error")',
        schema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'The complete search query string in Sentry search syntax',
            },
          },
          required: ['query'],
        },
      },
      {
        type: 'appendFilter',
        description:
          'Add a filter to the existing query. The filter will be appended with proper spacing.',
        schema: {
          type: 'object',
          properties: {
            filter: {
              type: 'string',
              description:
                'A single filter to append (e.g., "status:unresolved", "level:error")',
            },
          },
          required: ['filter'],
        },
      },
      {
        type: 'clearQuery',
        description: 'Clear the entire search query',
        schema: {type: 'object', properties: {}},
      },
    ],
    []
  );

  const llmHandlers = useMemo(
    () => ({
      setQuery: (payload: any) => {
        if (typeof payload?.query === 'string') {
          dispatch({type: 'UPDATE_QUERY', query: payload.query, shouldCommitQuery: true});
          handleSearch(payload.query);
        }
      },
      appendFilter: (payload: any) => {
        if (typeof payload?.filter === 'string') {
          const currentQuery = queryRef.current;
          const newQuery =
            currentQuery.trim() === ''
              ? payload.filter
              : `${currentQuery.trim()} ${payload.filter}`;
          dispatch({type: 'UPDATE_QUERY', query: newQuery, shouldCommitQuery: true});
          handleSearch(newQuery);
        }
      },
      clearQuery: () => {
        dispatch({type: 'CLEAR'});
        handleSearch('');
      },
    }),
    [dispatch, handleSearch]
  );

  const {ref: llmContextRef} = useLLMContext({
    name: 'search-query-builder',
    entity: 'search',
    description:
      'The search query builder allows filtering data using Sentry search syntax. Supports filters like "status:unresolved", "level:error", "is:assigned", etc.',
    data: llmData,
    actions: llmActions,
    onAction: llmHandlers,
  });

  return (
    <SearchQueryBuilderContext.Provider value={contextValue}>
      {children}
    </SearchQueryBuilderContext.Provider>
  );
}
