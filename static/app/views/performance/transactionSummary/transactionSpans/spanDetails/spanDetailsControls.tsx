import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';

import {Button} from 'sentry/components/button';
import SearchBar from 'sentry/components/events/searchBar';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import {removeHistogramQueryStrings} from 'sentry/utils/performance/histogram';
import {decodeScalar} from 'sentry/utils/queryString';

import {SPAN_RELATIVE_PERIODS, SPAN_RETENTION_DAYS} from '../utils';

import {ZoomKeys} from './utils';

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
      query: removeHistogramQueryStrings(location, Object.values(ZoomKeys)),
    });
  };

  const isZoomed = () => Object.values(ZoomKeys).some(key => location.query[key]);

  return (
    <FilterActions>
      <PageFilterBar condensed>
        <EnvironmentPageFilter />
        <DatePageFilter
          relativeOptions={SPAN_RELATIVE_PERIODS}
          maxPickableDays={SPAN_RETENTION_DAYS}
        />
      </PageFilterBar>
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
    </FilterActions>
  );
}

const FilterActions = styled('div')`
  display: grid;
  gap: ${space(2)};
  margin-bottom: ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    grid-template-columns: auto 1fr auto;
  }
`;
