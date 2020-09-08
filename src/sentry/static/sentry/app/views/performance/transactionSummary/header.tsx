import React from 'react';
import {Location} from 'history';
import styled from '@emotion/styled';

import {Organization, Project} from 'app/types';
import EventView from 'app/utils/discover/eventView';
import Feature from 'app/components/acl/feature';
import CreateAlertButton from 'app/components/createAlertButton';
import * as Layout from 'app/components/layouts/thirds';
import ButtonBar from 'app/components/buttonBar';
import ListLink from 'app/components/links/listLink';
import NavTabs from 'app/components/navTabs';
import {t} from 'app/locale';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import Breadcrumb from 'app/views/performance/breadcrumb';

import KeyTransactionButton from './keyTransactionButton';

export enum Tab {
  TransactionSummary,
  RealUserMonitoring,
}

type Props = {
  eventView: EventView;
  location: Location;
  organization: Organization;
  projects: Project[];
  transactionName: string;
  currentTab: Tab;
  handleIncompatibleQuery: React.ComponentProps<
    typeof CreateAlertButton
  >['onIncompatibleQuery'];
};

class TransactionHeader extends React.Component<Props> {
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
    this.props.handleIncompatibleQuery?.(incompatibleAlertNoticeFn, errors);
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

  get baseUrl() {
    const {organization} = this.props;
    return `/organizations/${organization.slug}/performance/summary/`;
  }

  render() {
    const {organization, location, transactionName, currentTab} = this.props;
    const baseUrl = this.baseUrl;

    return (
      <Layout.Header>
        <Layout.HeaderContent>
          <Breadcrumb
            organization={organization}
            location={location}
            transactionName={transactionName}
            realUserMonitoring={currentTab === Tab.RealUserMonitoring}
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
        <StyledNavTabs>
          <ListLink
            to={`${baseUrl}${location.search}`}
            isActive={() => currentTab === Tab.TransactionSummary}
          >
            {t('Overview')}
          </ListLink>
          <ListLink
            to={`${baseUrl}rum/${location.search}`}
            isActive={() => currentTab === Tab.RealUserMonitoring}
          >
            {t('Real User Monitoring')}
          </ListLink>
        </StyledNavTabs>
      </Layout.Header>
    );
  }
}

const StyledNavTabs = styled(NavTabs)`
  margin-bottom: 0;
  /* Makes sure the tabs are pushed into another row */
  width: 100%;
`;

export default TransactionHeader;
