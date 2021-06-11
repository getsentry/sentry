import * as React from 'react';
import {Fragment} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import {Location, LocationDescriptor, Query} from 'history';
import omit from 'lodash/omit';

import SearchBar from 'app/components/events/searchBar';
import * as Layout from 'app/components/layouts/thirds';
import {getParams} from 'app/components/organizations/globalSelectionHeader/getParams';
import Pagination from 'app/components/pagination';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Organization, Project} from 'app/types';
import DiscoverQuery, {TableDataRow} from 'app/utils/discover/discoverQuery';
import EventView from 'app/utils/discover/eventView';
import {generateEventSlug} from 'app/utils/discover/urls';
import {decodeScalar} from 'app/utils/queryString';
import {stringifyQueryObject, tokenizeSearch} from 'app/utils/tokenizeSearch';
import {Actions, updateQuery} from 'app/views/eventsV2/table/cellAction';
import {TableColumn} from 'app/views/eventsV2/table/types';
import {getTraceDetailsUrl} from 'app/views/performance/traceDetails/utils';

import {getCurrentLandingDisplay, LandingDisplayField} from '../../landing/utils';
import {getTransactionDetailsUrl} from '../../utils';
import {SpanOperationBreakdownFilter} from '../filter';
import TransactionHeader, {Tab} from '../header';

import TransactionsTable from './transactionsTable';

const DEFAULT_TRANSACTION_LIMIT = 12;

type Props = {
  location: Location;
  eventView: EventView;
  transactionName: string;
  organization: Organization;
  isLoading: boolean;
  totalValues: Record<string, number> | null;
  projects: Project[];
  spanOperationBreakdownFilter: SpanOperationBreakdownFilter;
  cursorName: string;
  limit: number;
};

const EventsPageContent = (props: Props) => {
  const {
    eventView,
    location,
    organization,
    projects,
    transactionName,
    limit = DEFAULT_TRANSACTION_LIMIT,
    cursorName = 'transactionCursor',
  } = props;

  const handleCursor = (cursor: string, pathname: string, query: Query) => {
    browserHistory.push({
      pathname,
      query: {...query, [cursorName]: cursor},
    });
  };

  const handleCellAction = (column: TableColumn<React.ReactText>) => {
    return (action: Actions, value: React.ReactText) => {
      const searchConditions = tokenizeSearch(eventView.query);

      // remove any event.type queries since it is implied to apply to only transactions
      searchConditions.removeTag('event.type');

      // no need to include transaction as its already in the query params
      searchConditions.removeTag('transaction');

      updateQuery(searchConditions, action, column, value);

      browserHistory.push({
        pathname: location.pathname,
        query: {
          ...location.query,
          cursor: undefined,
          query: stringifyQueryObject(searchConditions),
        },
      });
    };
  };

  const handleIncompatibleQuery = () => {};

  const transactionsListEventView = eventView.clone();

  const transactionsListTitles = [
    t('event id'),
    t('user'),
    t('operation duration'),
    t('total duration'),
    t('trace id'),
    t('timestamp'),
  ];
  const cursor = decodeScalar(location.query?.[cursorName]);

  return (
    <Fragment>
      <TransactionHeader
        eventView={transactionsListEventView}
        location={location}
        organization={organization}
        projects={projects}
        transactionName={transactionName}
        currentTab={Tab.Events}
        hasWebVitals={
          getCurrentLandingDisplay(location, projects, eventView).field ===
          LandingDisplayField.FRONTEND_PAGELOAD
        }
        handleIncompatibleQuery={handleIncompatibleQuery}
      />
      <Layout.Body>
        <Layout.Main fullWidth>
          <Search {...props} />
          <StyledTable>
            <DiscoverQuery
              location={location}
              eventView={transactionsListEventView}
              orgSlug={organization.slug}
              limit={limit}
              cursor={cursor}
              referrer="api.discover.transactions-list"
            >
              {({isLoading, pageLinks, tableData}) => {
                return (
                  <React.Fragment>
                    <TransactionsTable
                      eventView={eventView}
                      organization={organization}
                      location={location}
                      isLoading={isLoading}
                      tableData={tableData}
                      columnOrder={eventView.getColumns()}
                      titles={transactionsListTitles}
                      handleCellAction={handleCellAction}
                      generateLink={{
                        id: generateTransactionLink(transactionName),
                        trace: generateTraceLink(
                          eventView.normalizeDateSelection(location)
                        ),
                      }}
                    />
                    <Pagination
                      pageLinks={pageLinks}
                      onCursor={handleCursor}
                      size="small"
                    />
                  </React.Fragment>
                );
              }}
            </DiscoverQuery>
          </StyledTable>
        </Layout.Main>
      </Layout.Body>
    </Fragment>
  );
};

function generateTraceLink(dateSelection) {
  return (
    organization: Organization,
    tableRow: TableDataRow,
    _query: Query
  ): LocationDescriptor => {
    const traceId = `${tableRow.trace}`;
    if (!traceId) {
      return {};
    }

    return getTraceDetailsUrl(organization, traceId, dateSelection, {});
  };
}

function generateTransactionLink(transactionName: string) {
  return (
    organization: Organization,
    tableRow: TableDataRow,
    query: Query
  ): LocationDescriptor => {
    const eventSlug = generateEventSlug(tableRow);
    return getTransactionDetailsUrl(organization, eventSlug, transactionName, query);
  };
}

const Search = (props: Props) => {
  const {eventView, location, organization} = props;

  const handleSearch = (query: string) => {
    const queryParams = getParams({
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
  return (
    <StyledSearchBar
      organization={organization}
      projectIds={eventView.project}
      query={query}
      fields={eventView.fields}
      onSearch={handleSearch}
    />
  );
};

const StyledSearchBar = styled(SearchBar)`
  flex-grow: 1;
`;
const StyledTable = styled('div')`
  flex-grow: 1;
  padding-top: ${space(2)};
`;

export default EventsPageContent;
