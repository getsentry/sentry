import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';
import omit from 'lodash/omit';

import Button from 'sentry/components/button';
import DropdownControl, {DropdownItem} from 'sentry/components/dropdownControl';
import SearchBar from 'sentry/components/events/searchBar';
import * as Layout from 'sentry/components/layouts/thirds';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import {WebVital} from 'sentry/utils/discover/fields';
import {decodeScalar} from 'sentry/utils/queryString';

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
  transactionName: string;
  percentileValues?: Record<EventsDisplayFilterName, number>;
  webVital?: WebVital;
};

const transactionsListTitles = [
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
  } = props;

  const eventView = originalEventView.clone();

  if (webVital) {
    transactionsListTitles.splice(3, 0, t(webVital));
  }

  const spanOperationBreakdownConditions = filterToSearchConditions(
    spanOperationBreakdownFilter,
    location
  );

  if (spanOperationBreakdownConditions) {
    eventView.query = `${eventView.query} ${spanOperationBreakdownConditions}`.trim();
    transactionsListTitles.splice(2, 1, t(`${spanOperationBreakdownFilter} duration`));
  }

  return (
    <Layout.Main fullWidth>
      <Search {...props} />
      <StyledTable>
        <EventsTable
          eventView={eventView}
          organization={organization}
          location={location}
          setError={setError}
          columnTitles={transactionsListTitles}
          transactionName={transactionName}
        />
      </StyledTable>
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

  return (
    <SearchWrapper>
      <Filter
        organization={organization}
        currentFilter={spanOperationBreakdownFilter}
        onChangeFilter={onChangeSpanOperationBreakdownFilter}
      />
      <StyledSearchBar
        organization={organization}
        projectIds={eventView.project}
        query={query}
        fields={eventView.fields}
        onSearch={handleSearch}
      />
      <SearchRowMenuItem>
        <DropdownControl
          buttonProps={{prefix: t('Percentile')}}
          label={eventsFilterOptions[eventsDisplayFilterName].label}
        >
          {Object.entries(eventsFilterOptions).map(([name, filter]) => {
            return (
              <DropdownItem
                key={name}
                onSelect={onChangeEventsDisplayFilter}
                eventKey={name}
                data-test-id={name}
                isActive={eventsDisplayFilterName === name}
              >
                {filter.label}
              </DropdownItem>
            );
          })}
        </DropdownControl>
      </SearchRowMenuItem>
      <SearchRowMenuItem>
        <Button to={eventView.getResultsViewUrlTarget(organization.slug)}>
          {t('Open in Discover')}
        </Button>
      </SearchRowMenuItem>
    </SearchWrapper>
  );
}

const SearchWrapper = styled('div')`
  display: flex;
  width: 100%;
  margin-bottom: ${space(3)};
`;

const StyledSearchBar = styled(SearchBar)`
  flex-grow: 1;
`;

const StyledTable = styled('div')`
  flex-grow: 1;
`;

const SearchRowMenuItem = styled('div')`
  margin-left: ${space(1)};
  flex-grow: 0;
`;

export default EventsContent;
