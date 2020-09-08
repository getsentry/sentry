import React from 'react';
import {Location} from 'history';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import omit from 'lodash/omit';

import CreateAlertButton from 'app/components/createAlertButton';
import * as Layout from 'app/components/layouts/thirds';
import {getParams} from 'app/components/organizations/globalSelectionHeader/getParams';
import space from 'app/styles/space';
import {Organization, Project} from 'app/types';
import EventView from 'app/utils/discover/eventView';
import {decodeScalar} from 'app/utils/queryString';
import SearchBar from 'app/views/events/searchBar';

import TransactionVitals from './transactionVitals';
// import BaselineValues from './baselineValues';
import TransactionHeader, {Tab} from '../transactionSummary/header';

type Props = {
  location: Location;
  eventView: EventView;
  transactionName: string;
  organization: Organization;
  projects: Project[];
};

type State = {
  incompatibleAlertNotice: React.ReactNode;
};

class RumContent extends React.Component<Props, State> {
  state: State = {
    incompatibleAlertNotice: null,
  };

  handleSearch = (query: string) => {
    const {location} = this.props;

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

  handleIncompatibleQuery: React.ComponentProps<
    typeof CreateAlertButton
  >['onIncompatibleQuery'] = (incompatibleAlertNoticeFn, _errors) => {
    const incompatibleAlertNotice = incompatibleAlertNoticeFn(() =>
      this.setState({incompatibleAlertNotice: null})
    );
    this.setState({incompatibleAlertNotice});
  };

  render() {
    const {transactionName, location, eventView, projects, organization} = this.props;
    const {incompatibleAlertNotice} = this.state;
    const query = decodeScalar(location.query.query) || '';

    return (
      <React.Fragment>
        <TransactionHeader
          eventView={eventView}
          location={location}
          organization={organization}
          projects={projects}
          transactionName={transactionName}
          currentTab={Tab.RealUserMonitoring}
          handleIncompatibleQuery={this.handleIncompatibleQuery}
        />
        <Layout.Body>
          {incompatibleAlertNotice && (
            <Layout.Main fullWidth>{incompatibleAlertNotice}</Layout.Main>
          )}
          <Layout.Main fullWidth>
            <StyledSearchBar
              organization={organization}
              projectIds={eventView.project}
              query={query}
              fields={eventView.fields}
              onSearch={this.handleSearch}
            />
            <TransactionVitals
              organization={organization}
              location={location}
              eventView={eventView}
            />
          </Layout.Main>
        </Layout.Body>
      </React.Fragment>
    );
  }
}

const StyledSearchBar = styled(SearchBar)`
  margin-bottom: ${space(3)};
`;

export default RumContent;
