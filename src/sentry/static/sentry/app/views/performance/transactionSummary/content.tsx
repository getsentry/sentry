import React from 'react';
import {Location} from 'history';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import omit from 'lodash/omit';

import {Organization, Project} from 'app/types';
import {getParams} from 'app/components/organizations/globalSelectionHeader/getParams';
import space from 'app/styles/space';
import {generateQueryWithTag} from 'app/utils';
import EventView from 'app/utils/discover/eventView';
import CreateAlertButton from 'app/components/createAlertButton';
import * as Layout from 'app/components/layouts/thirds';
import Tags from 'app/views/eventsV2/tags';
import SearchBar from 'app/views/events/searchBar';
import {decodeScalar} from 'app/utils/queryString';
import withProjects from 'app/utils/withProjects';

import TransactionHeader from './header';
import TransactionList from './transactionList';
import UserStats from './userStats';
import TransactionSummaryCharts from './charts';
import RelatedIssues from './relatedIssues';
import SidebarCharts from './sidebarCharts';
import StatusBreakdown from './statusBreakdown';

type Props = {
  location: Location;
  eventView: EventView;
  transactionName: string;
  organization: Organization;
  totalValues: Record<string, number> | undefined;
  projects: Project[];
};

type State = {
  incompatibleAlertNotice: React.ReactNode;
};

class SummaryContent extends React.Component<Props, State> {
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

  generateTagUrl = (key: string, value: string) => {
    const {location} = this.props;
    const query = generateQueryWithTag(location.query, {key, value});

    return {
      ...location,
      query,
    };
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
    const {
      transactionName,
      location,
      eventView,
      organization,
      projects,
      totalValues,
    } = this.props;
    const {incompatibleAlertNotice} = this.state;
    const query = decodeScalar(location.query.query) || '';
    const totalCount = totalValues ? totalValues.count : null;
    const slowDuration = totalValues ? totalValues.p95 : undefined;

    return (
      <React.Fragment>
        <TransactionHeader
          eventView={eventView}
          location={location}
          organization={organization}
          projects={projects}
          transactionName={transactionName}
          handleIncompatibleQuery={this.handleIncompatibleQuery}
        />
        <Layout.Body>
          {incompatibleAlertNotice && (
            <Layout.Main fullWidth>{incompatibleAlertNotice}</Layout.Main>
          )}
          <Layout.Main>
            <StyledSearchBar
              organization={organization}
              projectIds={eventView.project}
              query={query}
              fields={eventView.fields}
              onSearch={this.handleSearch}
            />
            <TransactionSummaryCharts
              organization={organization}
              location={location}
              eventView={eventView}
              totalValues={totalCount}
            />
            <TransactionList
              organization={organization}
              transactionName={transactionName}
              location={location}
              eventView={eventView}
              slowDuration={slowDuration}
            />
            <RelatedIssues
              organization={organization}
              location={location}
              transaction={transactionName}
              start={eventView.start}
              end={eventView.end}
              statsPeriod={eventView.statsPeriod}
            />
          </Layout.Main>
          <Layout.Side>
            <UserStats
              organization={organization}
              location={location}
              totals={totalValues}
            />
            <SidebarCharts organization={organization} eventView={eventView} />
            <StatusBreakdown
              eventView={eventView}
              organization={organization}
              location={location}
            />
            <Tags
              generateUrl={this.generateTagUrl}
              totalValues={totalCount}
              eventView={eventView}
              organization={organization}
              location={location}
            />
          </Layout.Side>
        </Layout.Body>
      </React.Fragment>
    );
  }
}

const StyledSearchBar = styled(SearchBar)`
  margin-bottom: ${space(1)};
`;

export default withProjects(SummaryContent);
