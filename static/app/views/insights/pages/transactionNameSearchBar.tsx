import {useCallback, useRef, useState} from 'react';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';

import BaseSearchBar from 'sentry/components/searchBar';
import SearchDropdown from 'sentry/components/searchBar/searchDropdown';
import type {SearchGroup} from 'sentry/components/searchBar/types';
import {ItemType} from 'sentry/components/searchBar/types';
import {getSearchGroupWithItemMarkedActive} from 'sentry/components/searchBar/utils';
import {DEFAULT_DEBOUNCE_DURATION} from 'sentry/constants';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOnClickOutside from 'sentry/utils/useOnClickOutside';
import usePageFilters from 'sentry/utils/usePageFilters';
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
  const [searchResults, setSearchResults] = useState<SearchGroup[]>([]);
  const transactionCount = searchResults[0]?.children?.length || 0;
  const [highlightedItemIndex, setHighlightedItemIndex] = useState(-1);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const openDropdown = () => setIsDropdownOpen(true);
  const closeDropdown = () => setIsDropdownOpen(false);
  const [loading, setLoading] = useState(false);
  const [searchString, setSearchString] = useState(searchQuery);
  const containerRef = useRef<HTMLDivElement>(null);
  const {
    selection: {projects: selectedProjectIds},
  } = usePageFilters();
  useOnClickOutside(containerRef, useCallback(closeDropdown, []));

  const getTraceItemAttributeValues = useGetTraceItemAttributeValues({
    traceItemType: TraceItemDataset.SPANS,
    type: 'string',
  });

  const handleSearchChange = (query: any) => {
    setSearchString(query);

    if (query.length === 0) {
      onSearch('');
    }

    if (query.length < 3) {
      setSearchResults([]);
      closeDropdown();
      return;
    }

    openDropdown();
    getSuggestedTransactions(query);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    const {key} = event;

    if (loading) {
      return;
    }

    if (key === 'Escape' && isDropdownOpen) {
      closeDropdown();
      return;
    }

    if (
      (key === 'ArrowUp' || key === 'ArrowDown') &&
      isDropdownOpen &&
      transactionCount > 0
    ) {
      const currentHighlightedItem = searchResults[0]!.children[highlightedItemIndex];
      const nextHighlightedItemIndex =
        (highlightedItemIndex + transactionCount + (key === 'ArrowUp' ? -1 : 1)) %
        transactionCount;
      setHighlightedItemIndex(nextHighlightedItemIndex);
      const nextHighlightedItem = searchResults[0]!.children[nextHighlightedItemIndex];

      let newSearchResults = searchResults;
      if (currentHighlightedItem) {
        newSearchResults = getSearchGroupWithItemMarkedActive(
          searchResults,
          currentHighlightedItem,
          false
        );
      }

      if (nextHighlightedItem) {
        newSearchResults = getSearchGroupWithItemMarkedActive(
          newSearchResults,
          nextHighlightedItem,
          true
        );
      }

      setSearchResults(newSearchResults);
      return;
    }

    if (key === 'Enter') {
      event.preventDefault();
      const currentItem = searchResults[0]?.children[highlightedItemIndex];

      if (currentItem?.value) {
        handleChooseItem(currentItem.value);
      } else {
        handleSearch(searchString, true);
      }
    }
  };

  const getSuggestedTransactions = debounce(
    async query => {
      try {
        setLoading(true);

        const results = await getTraceItemAttributeValues(
          {
            key: SpanFields.TRANSACTION,
            name: SpanFields.TRANSACTION,
            kind: undefined,
          },
          query
        );

        const parsedResults = results.reduce(
          (searchGroup: SearchGroup, item: string) => {
            searchGroup.children.push({
              value: item,
              title: item,
              type: ItemType.LINK,
              desc: '',
            });
            return searchGroup;
          },
          {
            title: 'All Transactions',
            children: [],
            icon: null,
            type: 'header',
          }
        );

        setHighlightedItemIndex(-1);

        setSearchResults([parsedResults]);
      } catch (_) {
        throw new Error('Unable to fetch event field values');
      } finally {
        setLoading(false);
      }
    },
    DEFAULT_DEBOUNCE_DURATION,
    {leading: true}
  );

  const handleChooseItem = (transactionName: string) => {
    handleSearch(transactionName, false);
  };

  const handleClickItemIcon = (value: string) => {
    const item = decodeValueToItem(value);
    navigateToItemTransactionSummary(item);
  };

  const handleSearch = (query: string, asRawText: boolean) => {
    setSearchResults([]);
    setSearchString(query);
    query = new MutableSearch(query).formatString();

    const fullQuery = asRawText ? query : `transaction:"${query}"`;
    onSearch(query ? fullQuery : '');
    closeDropdown();
  };

  const navigateToItemTransactionSummary = (item: DataItem) => {
    const {transaction} = item;

    setSearchResults([]);

    const next = transactionSummaryRouteWithQuery({
      view,
      organization,
      transaction,
      projectID: projectIds.length
        ? projectIds
        : selectedProjectIds.map(id => id.toString()),
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
      className={className || ''}
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
          onDocsOpen={() => logDocsOpenedEvent()}
        />
      )}
    </Container>
  );
}

const decodeValueToItem = (value: string): DataItem => {
  const lastIndex = value.lastIndexOf(':');

  return {
    transaction: value.slice(0, lastIndex),
  };
};

interface DataItem {
  transaction: string;
}

const Container = styled('div')`
  position: relative;
`;
