import * as React from 'react';
import {Fragment} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';
import omit from 'lodash/omit';

import SearchBar from 'app/components/events/searchBar';
import {getParams} from 'app/components/organizations/globalSelectionHeader/getParams';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Organization, Project} from 'app/types';
import DiscoverQuery from 'app/utils/discover/discoverQuery';
import EventView from 'app/utils/discover/eventView';
import {decodeScalar} from 'app/utils/queryString';
import {stringifyQueryObject, tokenizeSearch} from 'app/utils/tokenizeSearch';
import {Actions, updateQuery} from 'app/views/eventsV2/table/cellAction';
import {TableColumn} from 'app/views/eventsV2/table/types';

import {getCurrentLandingDisplay, LandingDisplayField} from '../../landing/utils';
import {SpanOperationBreakdownFilter} from '../filter';
import TransactionHeader, {Tab} from '../header';

import TransactionsTable from './transactionsTable';

type Props = {
  location: Location;
  eventView: EventView;
  transactionName: string;
  organization: Organization;
  isLoading: boolean;
  totalValues: Record<string, number> | null;
  projects: Project[];
  spanOperationBreakdownFilter: SpanOperationBreakdownFilter;
};

class EventsPageContent extends React.Component<Props> {
  handleTransactionsListSortChange = (value: string) => {
    const {location} = this.props;
    const target = {
      pathname: location.pathname,
      query: {...location.query, showTransactions: value, transactionCursor: undefined},
    };
    browserHistory.push(target);
  };

  handleCellAction = (column: TableColumn<React.ReactText>) => {
    return (action: Actions, value: React.ReactText) => {
      const {eventView, location} = this.props;

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

  render() {
    const {eventView, location, organization, projects, transactionName} = this.props;

    const handleIncompatibleQuery = () => {};

    const transactionsListEventView = eventView.clone();

    const transactionsListTitles = [
      t('event id'),
      t('user'),
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
        <LayoutBody>
          <Search {...this.props} />
          <DiscoverQuery
            location={location}
            eventView={transactionsListEventView}
            orgSlug={organization.slug}
            limit={10}
            cursor={cursor}
            referrer="api.discover.transactions-list"
          >
            {({isLoading, _pageLinks, tableData}) => {
              console.log('-QUIERY');
              console.log(tableData);
              return (
                <TransactionsTable
                  eventView={eventView}
                  organization={organization}
                  location={location}
                  isLoading={isLoading}
                  tableData={tableData}
                  columnOrder={eventView.getColumns()}
                  titles={transactionsListTitles}
                  handleCellAction={this.handleCellAction}
                />
              );
            }}
          </DiscoverQuery>
        </LayoutBody>
      </Fragment>
    );
  }
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

// TODO(k-fish): Adjust thirds layout to allow for this instead.
const LayoutBody = styled('div')`
  padding: ${space(2)};
  margin: 0;
  background-color: ${p => p.theme.background};
  flex-grow: 1;
`;

// const Search = styled('div')`
//   display: flex;
//   width: 100%;
//   margin-bottom: ${space(3)};
// `;

const StyledSearchBar = styled(SearchBar)`
  flex-grow: 1;
`;

export default EventsPageContent;
