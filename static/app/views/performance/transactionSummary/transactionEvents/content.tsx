import * as React from 'react';
import {Fragment} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';
import omit from 'lodash/omit';

import {CreateAlertFromViewButton} from 'app/components/createAlertButton';
import SearchBar from 'app/components/events/searchBar';
import GlobalSdkUpdateAlert from 'app/components/globalSdkUpdateAlert';
import * as Layout from 'app/components/layouts/thirds';
import {getParams} from 'app/components/organizations/globalSelectionHeader/getParams';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Organization, Project} from 'app/types';
import EventView from 'app/utils/discover/eventView';
import {decodeScalar} from 'app/utils/queryString';
import {stringifyQueryObject, tokenizeSearch} from 'app/utils/tokenizeSearch';
import {Actions, updateQuery} from 'app/views/eventsV2/table/cellAction';
import {TableColumn} from 'app/views/eventsV2/table/types';

import {getCurrentLandingDisplay, LandingDisplayField} from '../../landing/utils';
import Table from '../../table';
import TransactionHeader, {Tab} from '../header';

type Props = {
  location: Location;
  eventView: EventView;
  transactionName: string;
  organization: Organization;
  projects: Project[];
};

type State = {
  incompatibleAlertNotice: React.ReactNode;
  error: string | undefined;
};

class EventsPageContent extends React.Component<Props, State> {
  state: State = {
    incompatibleAlertNotice: null,
    error: undefined,
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

  setError = (error: string | undefined) => {
    this.setState({error});
  };

  render() {
    const {eventView, location, organization, projects, transactionName} = this.props;
    const {incompatibleAlertNotice} = this.state;
    const transactionsListTitles = [
      t('event id'),
      t('user'),
      t('operation duration'),
      t('total duration'),
      t('trace id'),
      t('timestamp'),
    ];

    return (
      <Fragment>
        <TransactionHeader
          eventView={eventView}
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
              <Table
                eventView={eventView}
                projects={projects}
                organization={organization}
                location={location}
                setError={this.setError}
                summaryConditions={eventView.getQueryWithAdditionalConditions()}
                columnTitles={transactionsListTitles}
              />
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
