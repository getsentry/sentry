import {useCallback, useState} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';

import BaseSearchBar from 'sentry/components/searchBar';
import {DEFAULT_DEBOUNCE_DURATION} from 'sentry/constants';
import {t} from 'sentry/locale';
import {Organization} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import {doDiscoverQuery} from 'sentry/utils/discover/genericDiscoverQuery';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useApi from 'sentry/utils/useApi';
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
  const [loading, setLoading] = useState(false);
  const [searchString, setSearchString] = useState(searchQuery);

  const api = useApi();
  const eventView = _eventView.clone();

  const useEvents = organization.features.includes(
    'performance-frontend-use-events-endpoint'
  );

  const url = useEvents
    ? `/organizations/${organization.slug}/events/`
    : `/organizations/${organization.slug}/eventsv2/`;

  const projectIdStrings = (eventView.project as Readonly<number>[])?.map(String);

  const prepareQuery = (query: string) => {
    const prependedChar = query[0] === '*' ? '' : '*';
    const appendedChar = query[query.length - 1] === '*' ? '' : '*';
    return `${prependedChar}${query}${appendedChar}`;
  };

  // `debounce` in functional components has to be wrapped in `useCallback`
  // because otherwise the debounce is recreated on every render and becomes
  // pointless. The exhaustive deps check is mad because it's not getting an
  // inline function so it can't determine the dependencies. `useMemo` is a
  // tempting replacement, but apparently React might randomly clear that to
  // save memory
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const getSuggestedTransactions = useCallback(
    debounce(
      async query => {
        if (query.length === 0) {
          onSearch('');
        }

        if (query.length < 3) {
          setSearchResults([]);
          return;
        }

        setSearchString(query);

        try {
          setLoading(true);
          const conditions = new MutableSearch('');
          conditions.addFilterValues('transaction', [prepareQuery(query)], false);
          conditions.addFilterValues('event.type', ['transaction']);

          // clear any active requests
          if (Object.keys(api.activeRequests).length) {
            api.clear();
          }

          const [results] = await doDiscoverQuery<{
            data: Array<{'count()': number; project_id: number; transaction: string}>;
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
                value: `${item.transaction}:${item.project_id}`,
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
    [api, url, eventView.statsPeriod, onSearch, projectIdStrings.join(',')]
  );

  const handleSearch = (query: string) => {
    const lastIndex = query.lastIndexOf(':');
    const transactionName = query.slice(0, lastIndex);
    setSearchResults([]);
    setSearchString(transactionName);
    onSearch(`transaction:${transactionName}`);
  };

  const navigateToTransactionSummary = (name: string) => {
    const lastIndex = name.lastIndexOf(':');
    const transactionName = name.slice(0, lastIndex);
    const projectId = name.slice(lastIndex + 1);
    const query = eventView.generateQueryStringObject();
    setSearchResults([]);

    const next = transactionSummaryRouteWithQuery({
      orgSlug: organization.slug,
      transaction: String(transactionName),
      projectID: projectId,
      query,
    });
    browserHistory.push(next);
  };

  return (
    <Container data-test-id="transaction-search-bar">
      <BaseSearchBar
        placeholder={t('Search Transactions')}
        onChange={getSuggestedTransactions}
        query={searchString}
      />
      <SearchDropdown
        css={{
          display: searchResults[0]?.children.length ? 'block' : 'none',
        }}
        maxMenuHeight={300}
        searchSubstring={searchString}
        loading={loading}
        items={searchResults}
        onClick={handleSearch}
        onIconClick={navigateToTransactionSummary}
      />
    </Container>
  );
}

const Container = styled('div')`
  position: relative;
`;

export default SearchBar;
