import {useCallback, useRef, useState} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';

import BaseSearchBar from 'sentry/components/searchBar';
import {getSearchGroupWithItemMarkedActive} from 'sentry/components/smartSearchBar/utils';
import {DEFAULT_DEBOUNCE_DURATION} from 'sentry/constants';
import {t} from 'sentry/locale';
import {Organization} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import {doDiscoverQuery} from 'sentry/utils/discover/genericDiscoverQuery';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useApi from 'sentry/utils/useApi';
import useOnClickOutside from 'sentry/utils/useOnClickOutside';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import {transactionSummaryRouteWithQuery} from 'sentry/views/performance/transactionSummary/utils';

import SearchDropdown from '../smartSearchBar/searchDropdown';
import {ItemType, SearchGroup} from '../smartSearchBar/types';

export type SearchBarProps = {
  eventView: EventView;
  onSearch: (query: string) => void;
  organization: Organization;
  query: string;
};

function SearchBar(props: SearchBarProps) {
  const {organization, eventView: _eventView, onSearch, query: searchQuery} = props;

  const [searchResults, setSearchResults] = useState<SearchGroup[]>([]);
  const transactionCount = searchResults[0]?.children?.length || 0;
  const [highlightedItemIndex, setHighlightedItemIndex] = useState(-1);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const openDropdown = () => setIsDropdownOpen(true);
  const closeDropdown = () => setIsDropdownOpen(false);
  const [loading, setLoading] = useState(false);
  const [searchString, setSearchString] = useState(searchQuery);
  const containerRef = useRef<HTMLDivElement>(null);
  useOnClickOutside(containerRef, useCallback(closeDropdown, []));

  const api = useApi();
  const eventView = _eventView.clone();

  const url = `/organizations/${organization.slug}/events/`;

  const projectIdStrings = (eventView.project as Readonly<number>[])?.map(String);

  const handleSearchChange = query => {
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
      const currentHighlightedItem = searchResults[0].children[highlightedItemIndex];
      const nextHighlightedItemIndex =
        (highlightedItemIndex + transactionCount + (key === 'ArrowUp' ? -1 : 1)) %
        transactionCount;
      setHighlightedItemIndex(nextHighlightedItemIndex);
      const nextHighlightedItem = searchResults[0].children[nextHighlightedItemIndex];

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

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const getSuggestedTransactions = useCallback(
    debounce(
      async query => {
        try {
          setLoading(true);
          const conditions = new MutableSearch('');
          conditions.addFilterValues('transaction', [wrapQueryInWildcards(query)], false);
          conditions.addFilterValues('event.type', ['transaction']);

          // clear any active requests
          if (Object.keys(api.activeRequests).length) {
            api.clear();
          }

          const [results] = await doDiscoverQuery<{
            data: DataItem[];
          }>(api, url, {
            field: ['transaction', 'project_id', 'count()'],
            project: projectIdStrings,
            sort: '-count()',
            query: conditions.formatString(),
            statsPeriod: eventView.statsPeriod,
            referrer: 'api.performance.transaction-name-search-bar',
          });

          const parsedResults = results.data.reduce(
            (searchGroup: SearchGroup, item) => {
              searchGroup.children.push({
                value: encodeItemToValue(item),
                title: item.transaction,
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
    ),
    [api, url, eventView.statsPeriod, projectIdStrings.join(',')]
  );

  const handleChooseItem = (value: string) => {
    const item = decodeValueToItem(value);
    handleSearch(item.transaction, false);
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
    const {transaction, project_id} = item;

    const query = eventView.generateQueryStringObject();
    setSearchResults([]);

    const next = transactionSummaryRouteWithQuery({
      orgSlug: organization.slug,
      transaction,
      projectID: String(project_id),
      query,
    });

    browserHistory.push(normalizeUrl(next));
  };

  return (
    <Container data-test-id="transaction-search-bar" ref={containerRef}>
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
        />
      )}
    </Container>
  );
}

const encodeItemToValue = (item: DataItem) => {
  return `${item.transaction}:${item.project_id}`;
};

const decodeValueToItem = (value: string): DataItem => {
  const lastIndex = value.lastIndexOf(':');

  return {
    project_id: parseInt(value.slice(lastIndex + 1), 10),
    transaction: value.slice(0, lastIndex),
  };
};

interface DataItem {
  project_id: number;
  transaction: string;
  'count()'?: number;
}

export const wrapQueryInWildcards = (query: string) => {
  if (!query.startsWith('*')) {
    query = '*' + query;
  }

  if (!query.endsWith('*')) {
    query = query + '*';
  }

  return query;
};

const Container = styled('div')`
  position: relative;
`;

export default SearchBar;
