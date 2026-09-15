import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {useDebouncedState} from '@tanstack/react-pacer';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {SearchBar as BaseSearchBar} from 'sentry/components/searchBar';
import {SearchDropdown} from 'sentry/components/searchBar/searchDropdown';
import type {SearchGroup} from 'sentry/components/searchBar/types';
import {ItemType} from 'sentry/components/searchBar/types';
import {DEFAULT_DEBOUNCE_DURATION} from 'sentry/constants';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOnClickOutside} from 'sentry/utils/useOnClickOutside';
import {useGetTraceItemAttributeValues} from 'sentry/views/explore/hooks/useGetTraceItemAttributeValues';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {useDomainViewFilters} from 'sentry/views/insights/pages/useFilters';
import {SpanFields} from 'sentry/views/insights/types';
import {transactionSummaryRouteWithQuery} from 'sentry/views/performance/transactionSummary/utils';

type SearchBarProps = {
  onSearch: (query: string) => void;
  organization: Organization;
  /** The project ids to search for */
  projectIds: Array<Project['id']>;
  /** The query in the search bar */
  query: string;
  className?: string;
};

export function TransactionNameSearchBar(props: SearchBarProps) {
  const {organization, onSearch, query: searchQuery, projectIds, className} = props;

  const navigate = useNavigate();
  const {view} = useDomainViewFilters();
  const {selection} = usePageFilters();
  const containerRef = useRef<HTMLDivElement>(null);
  const [highlightedItemIndex, setHighlightedItemIndex] = useState(-1);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchString, setSearchString] = useState(searchQuery);
  const [transactions, setTransactions] = useState<string[] | null>(null);
  const [debouncedSearch, setDebouncedSearch, {cancel: cancelSuggestions}] =
    useDebouncedState('', {wait: DEFAULT_DEBOUNCE_DURATION, leading: true});
  const getTraceItemAttributeValues = useGetTraceItemAttributeValues({
    traceItemType: TraceItemDataset.SPANS,
    type: 'string',
  });
  const isDebouncing = searchString !== debouncedSearch;
  const loading = isDebouncing || transactions === null;
  const transactionCount = transactions?.length ?? 0;
  const searchResults = useMemo<SearchGroup[]>(
    () => [
      {
        title: 'All Transactions',
        icon: null,
        type: 'header',
        children: (transactions ?? []).map((value, index) => ({
          value,
          title: value,
          type: ItemType.LINK,
          desc: '',
          active: index === highlightedItemIndex,
        })),
      },
    ],
    [transactions, highlightedItemIndex]
  );

  useEffect(() => {
    if (!isDropdownOpen || isDebouncing || debouncedSearch.length < 3) {
      return;
    }

    let ignore = false;

    async function fetchSuggestions() {
      setTransactions(null);
      try {
        const results = await getTraceItemAttributeValues({
          tag: {
            key: SpanFields.TRANSACTION,
            name: SpanFields.TRANSACTION,
            kind: undefined,
          },
          searchQuery: debouncedSearch,
        });
        if (!ignore) {
          setTransactions(results.map(item => item.value));
        }
      } catch {
        if (!ignore) {
          setTransactions([]);
          addErrorMessage(t('Unable to fetch transaction suggestions'));
        }
      }
    }

    void fetchSuggestions();

    return () => {
      // The shared request can finish, but this effect no longer owns the results.
      ignore = true;
    };
  }, [debouncedSearch, getTraceItemAttributeValues, isDebouncing, isDropdownOpen]);

  const closeDropdown = useCallback(() => {
    cancelSuggestions();
    setIsDropdownOpen(false);
  }, [cancelSuggestions]);

  useOnClickOutside(containerRef, closeDropdown);

  const handleSearchChange = (query: string) => {
    setSearchString(query);
    setTransactions(null);
    setHighlightedItemIndex(-1);

    if (query.length === 0) {
      onSearch('');
    }

    if (query.length < 3) {
      closeDropdown();
      return;
    }

    setIsDropdownOpen(true);
    setDebouncedSearch(query);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    const {key} = event;

    if (key === 'Escape' && isDropdownOpen) {
      closeDropdown();
      return;
    }

    if (
      (key === 'ArrowUp' || key === 'ArrowDown') &&
      !loading &&
      isDropdownOpen &&
      transactionCount > 0
    ) {
      setHighlightedItemIndex(
        (highlightedItemIndex + transactionCount + (key === 'ArrowUp' ? -1 : 1)) %
          transactionCount
      );
      return;
    }

    if (key === 'Enter') {
      event.preventDefault();
      const selectedTransaction =
        loading || !isDropdownOpen ? undefined : transactions?.[highlightedItemIndex];

      if (selectedTransaction) {
        handleChooseItem(selectedTransaction);
      } else {
        handleSearch(searchString, true);
      }
    }
  };

  const handleChooseItem = (transactionName: string) => {
    handleSearch(transactionName, false);
  };

  const handleSearch = (query: string, asRawText: boolean) => {
    setSearchString(query);
    const formattedQuery = new MutableSearch(query).formatString();

    const fullQuery = asRawText ? formattedQuery : `transaction:"${formattedQuery}"`;
    onSearch(formattedQuery ? fullQuery : '');
    closeDropdown();
  };

  const handleClickItemIcon = (value: string) => {
    const transaction = value.slice(0, value.lastIndexOf(':'));
    closeDropdown();

    const next = transactionSummaryRouteWithQuery({
      view,
      organization,
      transaction,
      projectID: projectIds.length ? projectIds : selection.projects.map(String),
      query: {},
    });

    navigate(next);
  };
  const logDocsOpenedEvent = () => {
    trackAnalytics('search.docs_opened', {
      organization,
      search_type: 'performance',
      search_source: 'performance_landing',
      query: props.query,
    });
  };

  return (
    <Container
      className={className}
      data-test-id="transaction-search-bar"
      ref={containerRef}
    >
      <BaseSearchBar
        placeholder={t('Search Transactions')}
        onChange={handleSearchChange}
        onKeyDown={handleKeyDown}
        query={searchString}
      />
      {isDropdownOpen && (
        <SearchDropdown
          maxMenuHeight={300}
          searchSubstring={searchString}
          loading={loading}
          items={searchResults}
          onClick={handleChooseItem}
          onIconClick={handleClickItemIcon}
          onDocsOpen={logDocsOpenedEvent}
        />
      )}
    </Container>
  );
}

const Container = styled('div')`
  position: relative;
`;
