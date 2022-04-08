import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';

import Button from 'sentry/components/button';
import SearchBar from 'sentry/components/events/searchBar';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import {removeHistogramQueryStrings} from 'sentry/utils/performance/histogram';
import {decodeScalar} from 'sentry/utils/queryString';

import {ZOOM_KEYS} from './utils';

interface SpanDetailsControlsProps {
  eventView: EventView;
  location: Location;
  organization: Organization;
}

export default function SpanDetailsControls({
  organization,
  eventView,
  location,
}: SpanDetailsControlsProps) {
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

  const handleResetView = () => {
    browserHistory.push({
      pathname: location.pathname,
      query: removeHistogramQueryStrings(location, ZOOM_KEYS),
    });
  };

  const isZoomed = () => ZOOM_KEYS.find(key => location.query[key]);

  return (
    <StyledActions>
      <SearchBar
        placeholder={t('Filter Transactions')}
        organization={organization}
        projectIds={eventView.project}
        query={query}
        fields={eventView.fields}
        onSearch={handleSearchQuery}
      />
      <Button onClick={handleResetView} disabled={!isZoomed()}>
        {t('Reset View')}
      </Button>
    </StyledActions>
  );
}

const StyledActions = styled('div')`
  display: grid;
  gap: ${space(2)};
  grid-template-columns: auto max-content;
  grid-template-rows: auto;
  align-items: center;
  margin-bottom: ${space(2)};
`;
