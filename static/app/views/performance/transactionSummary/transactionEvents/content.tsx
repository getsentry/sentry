import * as React from 'react';
import {Fragment} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import {Location, Query} from 'history';
import omit from 'lodash/omit';

import {CreateAlertFromViewButton} from 'app/components/createAlertButton';
import TransactionsTable from 'app/components/discover/transactionsTable';
import SearchBar from 'app/components/events/searchBar';
import GlobalSdkUpdateAlert from 'app/components/globalSdkUpdateAlert';
import * as Layout from 'app/components/layouts/thirds';
import {getParams} from 'app/components/organizations/globalSelectionHeader/getParams';
import Pagination from 'app/components/pagination';
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
import {generateTraceLink, generateTransactionLink} from '../utils';

const DEFAULT_TRANSACTION_LIMIT = 50;

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

type State = {
  incompatibleAlertNotice: React.ReactNode;
};

class EventsPageContent extends React.Component<Props, State> {
  static defaultProps = {
    cursorName: 'transactionCursor',
    limit: DEFAULT_TRANSACTION_LIMIT,
  };
  state: State = {
    incompatibleAlertNotice: null,
  };

  handleCursor = (cursor: string, pathname: string, query: Query) => {
    const {cursorName} = this.props;
    browserHistory.push({
      pathname,
      query: {...query, [cursorName]: cursor},
    });
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

  handleIncompatibleQuery: React.ComponentProps<
    typeof CreateAlertFromViewButton
  >['onIncompatibleQuery'] = (incompatibleAlertNoticeFn, _errors) => {
    const incompatibleAlertNotice = incompatibleAlertNoticeFn(() =>
      this.setState({incompatibleAlertNotice: null})
    );
    this.setState({incompatibleAlertNotice});
  };

  render() {
    const {
      eventView,
      location,
      organization,
      projects,
      transactionName,
      limit,
      cursorName,
    } = this.props;
    const {incompatibleAlertNotice} = this.state;

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
          handleIncompatibleQuery={this.handleIncompatibleQuery}
        />
        <Layout.Body>
          <StyledSdkUpdatesAlert />
          {incompatibleAlertNotice && (
            <Layout.Main fullWidth>{incompatibleAlertNotice}</Layout.Main>
          )}
          <Layout.Main fullWidth>
            <Search {...this.props} />
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
                        handleCellAction={this.handleCellAction}
                        generateLink={{
                          id: generateTransactionLink(transactionName),
                          trace: generateTraceLink(
                            eventView.normalizeDateSelection(location)
                          ),
                        }}
                        baselineTransactionName={null}
                        baselineData={null}
                      />
                      <Pagination
                        pageLinks={pageLinks}
                        onCursor={this.handleCursor}
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

const StyledSearchBar = styled(SearchBar)`
  flex-grow: 1;
`;
const StyledTable = styled('div')`
  flex-grow: 1;
  padding-top: ${space(2)};
`;

const StyledSdkUpdatesAlert = styled(GlobalSdkUpdateAlert)`
  @media (min-width: ${p => p.theme.breakpoints[1]}) {
    margin-bottom: 0;
  }
`;

StyledSdkUpdatesAlert.defaultProps = {
  Wrapper: p => <Layout.Main fullWidth {...p} />,
};

export default EventsPageContent;
