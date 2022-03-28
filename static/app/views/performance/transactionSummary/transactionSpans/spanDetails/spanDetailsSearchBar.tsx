import styled from '@emotion/styled';
import {Location} from 'history';

import _SearchBar from 'sentry/components/events/searchBar';
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

  return (
    <SearchBar
      placeholder="Filter Transactions"
      organization={organization}
      projectIds={eventView.project}
      query={query}
      fields={eventView.fields}
    />
  );
}

const SearchBar = styled(_SearchBar)`
  margin-bottom: ${space(2)};
`;
