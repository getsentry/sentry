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
import Feature from 'app/components/acl/feature';
import * as Layout from 'app/components/layouts/thirds';
import Tags from 'app/views/eventsV2/tags';
import SearchBar from 'app/views/events/searchBar';
import {decodeScalar} from 'app/utils/queryString';
import CreateAlertButton from 'app/components/createAlertButton';
import withProjects from 'app/utils/withProjects';
import ButtonBar from 'app/components/buttonBar';
import {trackAnalyticsEvent} from 'app/utils/analytics';

import TransactionList from './transactionList';
import UserStats from './userStats';
import KeyTransactionButton from './keyTransactionButton';
import TransactionSummaryCharts from './charts';
import RelatedIssues from './relatedIssues';
import SidebarCharts from './sidebarCharts';
import Breadcrumb from '../breadcrumb';

type Props = {
  location: Location;
  eventView: EventView;
  transactionName: string;
  organization: Organization;
  totalValues: number | null;
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

  trackAlertClick(errors?: Record<string, boolean>) {
    const {organization} = this.props;
    trackAnalyticsEvent({
      eventKey: 'performance_views.summary.create_alert_clicked',
      eventName: 'Performance Views: Create alert clicked',
      organization_id: organization.id,
      status: errors ? 'error' : 'success',
      errors,
      url: window.location.href,
    });
  }

  handleIncompatibleQuery: React.ComponentProps<
    typeof CreateAlertButton
  >['onIncompatibleQuery'] = (incompatibleAlertNoticeFn, errors) => {
    this.trackAlertClick(errors);
    const incompatibleAlertNotice = incompatibleAlertNoticeFn(() =>
      this.setState({incompatibleAlertNotice: null})
    );
    this.setState({incompatibleAlertNotice});
  };

  handleCreateAlertSuccess = () => {
    this.trackAlertClick();
  };

  renderCreateAlertButton() {
    const {eventView, organization, projects} = this.props;

    return (
      <CreateAlertButton
        eventView={eventView}
        organization={organization}
        projects={projects}
        onIncompatibleQuery={this.handleIncompatibleQuery}
        onSuccess={this.handleCreateAlertSuccess}
        referrer="performance"
      />
    );
  }

  renderKeyTransactionButton() {
    const {eventView, organization, transactionName} = this.props;

    return (
      <KeyTransactionButton
        transactionName={transactionName}
        eventView={eventView}
        organization={organization}
      />
    );
  }

  render() {
    const {transactionName, location, eventView, organization, totalValues} = this.props;
    const {incompatibleAlertNotice} = this.state;
    const query = decodeScalar(location.query.query) || '';

    return (
      <React.Fragment>
        <Layout.Header>
          <Layout.HeaderContent>
            <Breadcrumb
              organization={organization}
              location={location}
              transactionName={transactionName}
            />
            <Layout.Title>{transactionName}</Layout.Title>
          </Layout.HeaderContent>
          <Layout.HeaderActions>
            <ButtonBar gap={1}>
              <Feature organization={organization} features={['incidents']}>
                {({hasFeature}) => hasFeature && this.renderCreateAlertButton()}
              </Feature>
              {this.renderKeyTransactionButton()}
            </ButtonBar>
          </Layout.HeaderActions>
        </Layout.Header>
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
              totalValues={totalValues}
            />
            <TransactionList
              organization={organization}
              transactionName={transactionName}
              location={location}
              eventView={eventView}
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
              eventView={eventView}
            />
            <SidebarCharts organization={organization} eventView={eventView} />
            <Tags
              generateUrl={this.generateTagUrl}
              totalValues={totalValues}
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
