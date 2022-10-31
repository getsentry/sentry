import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';
import omit from 'lodash/omit';

import Button from 'sentry/components/button';
import CompactSelect from 'sentry/components/compactSelect';
import DatePageFilter from 'sentry/components/datePageFilter';
import EnvironmentPageFilter from 'sentry/components/environmentPageFilter';
import SearchBar from 'sentry/components/events/searchBar';
import * as Layout from 'sentry/components/layouts/thirds';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import EventView from 'sentry/utils/discover/eventView';
import {WebVital} from 'sentry/utils/fields';
import {decodeScalar} from 'sentry/utils/queryString';
import {useRoutes} from 'sentry/utils/useRoutes';

import Filter, {filterToSearchConditions, SpanOperationBreakdownFilter} from '../filter';
import {SetStateAction} from '../types';

import EventsTable from './eventsTable';
import {EventsDisplayFilterName, getEventsFilterOptions} from './utils';

type Props = {
  eventView: EventView;
  eventsDisplayFilterName: EventsDisplayFilterName;
  location: Location;
  onChangeEventsDisplayFilter: (eventsDisplayFilterName: EventsDisplayFilterName) => void;
  onChangeSpanOperationBreakdownFilter: (newFilter: SpanOperationBreakdownFilter) => void;
  organization: Organization;
  setError: SetStateAction<string | undefined>;
  spanOperationBreakdownFilter: SpanOperationBreakdownFilter;
  totalEventCount: string;
  transactionName: string;
  percentileValues?: Record<EventsDisplayFilterName, number>;
  webVital?: WebVital;
};

export const TRANSACTIONS_LIST_TITLES: Readonly<string[]> = [
  t('event id'),
  t('user'),
  t('operation duration'),
  t('total duration'),
  t('trace id'),
  t('timestamp'),
];

function EventsContent(props: Props) {
  const {
    location,
    organization,
    eventView: originalEventView,
    transactionName,
    spanOperationBreakdownFilter,
    webVital,
    setError,
    totalEventCount,
  } = props;
  const routes = useRoutes();
  const eventView = originalEventView.clone();
  const transactionsListTitles = TRANSACTIONS_LIST_TITLES.slice();

  if (webVital) {
    transactionsListTitles.splice(3, 0, webVital);
  }

  const spanOperationBreakdownConditions = filterToSearchConditions(
    spanOperationBreakdownFilter,
    location
  );

  if (spanOperationBreakdownConditions) {
    eventView.query = `${eventView.query} ${spanOperationBreakdownConditions}`.trim();
    transactionsListTitles.splice(2, 1, t('%s duration', spanOperationBreakdownFilter));
  }

  if (organization.features.includes('session-replay-ui')) {
    transactionsListTitles.push(t('replay'));
  }

  return (
    <Layout.Main fullWidth>
      <Search {...props} />
      <EventsTable
        totalEventCount={totalEventCount}
        eventView={eventView}
        organization={organization}
        routes={routes}
        location={location}
        setError={setError}
        columnTitles={transactionsListTitles}
        transactionName={transactionName}
      />
    </Layout.Main>
  );
}

function Search(props: Props) {
  const {
    eventView,
    location,
    organization,
    spanOperationBreakdownFilter,
    onChangeSpanOperationBreakdownFilter,
    eventsDisplayFilterName,
    onChangeEventsDisplayFilter,
    percentileValues,
  } = props;

  const handleSearch = (query: string) => {
    const queryParams = normalizeDateTimeParams({
      ...(location.query || {}),
      query,
    });

    // do not propagate pagination when making a new search
    const searchQueryParams = omit(queryParams, 'cursor');

    browserHistory.push({
      pathname: location.pathname,
      query: searchQueryParams,
    });
  };

  const query = decodeScalar(location.query.query, '');

  const eventsFilterOptions = getEventsFilterOptions(
    spanOperationBreakdownFilter,
    percentileValues
  );

  const handleDiscoverButtonClick = () => {
    trackAdvancedAnalyticsEvent('performance_views.all_events.open_in_discover', {
      organization,
    });
  };

  return (
    <FilterActions>
      <Filter
        organization={organization}
        currentFilter={spanOperationBreakdownFilter}
        onChangeFilter={onChangeSpanOperationBreakdownFilter}
      />
      <PageFilterBar condensed>
        <EnvironmentPageFilter />
        <DatePageFilter alignDropdown="left" />
      </PageFilterBar>
      <StyledSearchBar
        organization={organization}
        projectIds={eventView.project}
        query={query}
        fields={eventView.fields}
        onSearch={handleSearch}
      />
      <CompactSelect
        triggerProps={{prefix: t('Percentile')}}
        value={eventsDisplayFilterName}
        onChange={opt => onChangeEventsDisplayFilter(opt.value)}
        options={Object.entries(eventsFilterOptions).map(([name, filter]) => ({
          value: name as EventsDisplayFilterName,
          label: filter.label,
        }))}
      />
      <Button
        to={eventView.getResultsViewUrlTarget(organization.slug)}
        onClick={handleDiscoverButtonClick}
      >
        {t('Open in Discover')}
      </Button>
    </FilterActions>
  );
}

const FilterActions = styled('div')`
  display: grid;
  gap: ${space(2)};
  margin-bottom: ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    grid-template-columns: repeat(4, min-content);
  }

  @media (min-width: ${p => p.theme.breakpoints.xlarge}) {
    grid-template-columns: auto auto 1fr auto auto;
  }
`;

const StyledSearchBar = styled(SearchBar)`
  @media (min-width: ${p => p.theme.breakpoints.small}) {
    order: 1;
    grid-column: 1/6;
  }

  @media (min-width: ${p => p.theme.breakpoints.xlarge}) {
    order: initial;
    grid-column: auto;
  }
`;

export default EventsContent;
