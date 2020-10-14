import React from 'react';
import {Location} from 'history';
import styled from '@emotion/styled';

import {Organization, Project} from 'app/types';
import EventView from 'app/utils/discover/eventView';
import {WebVital} from 'app/utils/discover/fields';
import Feature from 'app/components/acl/feature';
import CreateAlertButton from 'app/components/createAlertButton';
import * as Layout from 'app/components/layouts/thirds';
import ButtonBar from 'app/components/buttonBar';
import ListLink from 'app/components/links/listLink';
import NavTabs from 'app/components/navTabs';
import {t} from 'app/locale';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import DiscoverQuery from 'app/utils/discover/discoverQuery';
import {decodeScalar} from 'app/utils/queryString';
import {tokenizeSearch, stringifyQueryObject} from 'app/utils/tokenizeSearch';
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
        <Feature organization={organization} features={['measurements']}>
          {({hasFeature}) => {
            if (!hasFeature) {
              return null;
            }

            const query = tokenizeSearch(decodeScalar(location.query.query) || '')
              .setTagValues('event.type', ['transaction'])
              .setTagValues('transaction.op', ['pageload'])
              .setTagValues('transaction', [transactionName]);

            query.addOp('(');
            Object.values(WebVital).forEach((vital, index) => {
              if (index !== 0) {
                query.addOp('OR');
              }
              query.addStringTag(`has:${vital}`);
            });
            query.addOp(')');

            const eventView = EventView.fromNewQueryWithLocation(
              {
                id: undefined,
                version: 2,
                name: transactionName,
                fields: ['count()'],
                query: stringifyQueryObject(query),
                projects: [],
              },
              location
            );

            return (
              <StyledNavTabs>
                <ListLink
                  to={`${baseUrl}${location.search}`}
                  isActive={() => currentTab === Tab.TransactionSummary}
                >
                  {t('Overview')}
                </ListLink>
                <DiscoverQuery
                  location={location}
                  orgSlug={organization.slug}
                  eventView={eventView}
                  limit={1}
                >
                  {({isLoading, error, tableData}) => {
                    if (
                      isLoading ||
                      error !== null ||
                      (tableData?.data?.[0]?.count ?? 0) <= 0
                    ) {
                      return null;
                    }
                    return (
                      <ListLink
                        to={`${baseUrl}rum/${location.search}`}
                        isActive={() => currentTab === Tab.RealUserMonitoring}
                      >
                        {t('Web Vitals')}
                      </ListLink>
                    );
                  }}
                </DiscoverQuery>
              </StyledNavTabs>
            );
          }}
        </Feature>
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
