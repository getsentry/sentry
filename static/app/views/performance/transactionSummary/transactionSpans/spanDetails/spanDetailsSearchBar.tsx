import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';

import _SearchBar from 'sentry/components/events/searchBar';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import {decodeScalar} from 'sentry/utils/queryString';

interface SpanDetailsSearchBarProps {
  eventView: EventView;
  location: Location;
  organization: Organization;
}

export default function SpanDetailsSearchBar({
  organization,
  eventView,
  location,
}: SpanDetailsSearchBarProps) {
  const query = decodeScalar(location.query.query, '');

  const handleSearchQuery = (searchQuery: string): void => {
    browserHistory.push({
      pathname: location.pathname,
      query: {
        ...location.query,
        cursor: undefined,
        query: String(searchQuery).trim() || undefined,
      },
    });
  };

  return (
    <SearchBar
      placeholder={t('Filter Transactions')}
      organization={organization}
      projectIds={eventView.project}
      query={query}
      fields={eventView.fields}
      onSearch={handleSearchQuery}
    />
  );
}

const SearchBar = styled(_SearchBar)`
  margin-bottom: ${space(2)};
`;
