import * as React from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import Feature from 'app/components/acl/feature';
import {GuideAnchor} from 'app/components/assistant/guideAnchor';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import {CreateAlertFromViewButton} from 'app/components/createAlertButton';
import FeatureBadge from 'app/components/featureBadge';
import * as Layout from 'app/components/layouts/thirds';
import ListLink from 'app/components/links/listLink';
import NavTabs from 'app/components/navTabs';
import {IconSettings} from 'app/icons';
import {t} from 'app/locale';
import {Organization, Project} from 'app/types';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import EventView from 'app/utils/discover/eventView';
import {decodeScalar} from 'app/utils/queryString';
import Breadcrumb from 'app/views/performance/breadcrumb';

import {eventsRouteWithQuery} from './transactionEvents/utils';
import {tagsRouteWithQuery} from './transactionTags/utils';
import {vitalsRouteWithQuery} from './transactionVitals/utils';
import TeamKeyTransactionButton from './teamKeyTransactionButton';
import TransactionThresholdButton from './transactionThresholdButton';
import {TransactionThresholdMetric} from './transactionThresholdModal';
import {transactionSummaryRouteWithQuery} from './utils';

export enum Tab {
  TransactionSummary,
  RealUserMonitoring,
  Tags,
  Events,
}

type Props = {
  eventView: EventView;
  location: Location;
  organization: Organization;
  projects: Project[];
  transactionName: string;
  currentTab: Tab;
  hasWebVitals: boolean;
  onChangeThreshold?: (threshold: number, metric: TransactionThresholdMetric) => void;
  handleIncompatibleQuery: React.ComponentProps<
    typeof CreateAlertFromViewButton
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

  trackVitalsTabClick = () => {
    const {organization} = this.props;
    trackAnalyticsEvent({
      eventKey: 'performance_views.vitals.vitals_tab_clicked',
      eventName: 'Performance Views: Vitals tab clicked',
      organization_id: organization.id,
    });
  };

  trackTagsTabClick = () => {
    const {organization} = this.props;
    trackAnalyticsEvent({
      eventKey: 'performance_views.tags.tags_tab_clicked',
      eventName: 'Performance Views: Tags tab clicked',
      organization_id: organization.id,
    });
  };

  trackEventsTabClick = () => {
    const {organization} = this.props;
    trackAnalyticsEvent({
      eventKey: 'performance_views.events.events_tab_clicked',
      eventName: 'Performance Views: Events tab clicked',
      organization_id: organization.id,
    });
  };

  handleIncompatibleQuery: React.ComponentProps<
    typeof CreateAlertFromViewButton
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
      <CreateAlertFromViewButton
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
      <TeamKeyTransactionButton
        transactionName={transactionName}
        eventView={eventView}
        organization={organization}
      />
    );
  }

  renderSettingsButton() {
    const {organization, transactionName, eventView, onChangeThreshold} = this.props;

    return (
      <Feature
        organization={organization}
        features={['project-transaction-threshold-override']}
      >
        {({hasFeature}) =>
          hasFeature ? (
            <GuideAnchor
              target="project_transaction_threshold_override"
              position="bottom"
            >
              <TransactionThresholdButton
                organization={organization}
                transactionName={transactionName}
                eventView={eventView}
                onChangeThreshold={onChangeThreshold}
              />
            </GuideAnchor>
          ) : (
            <Button
              href={`/settings/${organization.slug}/performance/`}
              icon={<IconSettings />}
              aria-label={t('Settings')}
            />
          )
        }
      </Feature>
    );
  }

  render() {
    const {organization, location, transactionName, currentTab, hasWebVitals} =
      this.props;

    const summaryTarget = transactionSummaryRouteWithQuery({
      orgSlug: organization.slug,
      transaction: transactionName,
      projectID: decodeScalar(location.query.project),
      query: location.query,
    });

    const vitalsTarget = vitalsRouteWithQuery({
      orgSlug: organization.slug,
      transaction: transactionName,
      projectID: decodeScalar(location.query.project),
      query: location.query,
    });

    const tagsTarget = tagsRouteWithQuery({
      orgSlug: organization.slug,
      transaction: transactionName,
      projectID: decodeScalar(location.query.project),
      query: location.query,
    });

    const eventsTarget = eventsRouteWithQuery({
      orgSlug: organization.slug,
      transaction: transactionName,
      projectID: decodeScalar(location.query.project),
      query: location.query,
    });

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
            {this.renderSettingsButton()}
          </ButtonBar>
        </Layout.HeaderActions>
        <React.Fragment>
          <StyledNavTabs>
            <ListLink
              to={summaryTarget}
              isActive={() => currentTab === Tab.TransactionSummary}
            >
              {t('Overview')}
            </ListLink>
            {hasWebVitals && (
              <ListLink
                to={vitalsTarget}
                isActive={() => currentTab === Tab.RealUserMonitoring}
                onClick={this.trackVitalsTabClick}
              >
                {t('Web Vitals')}
              </ListLink>
            )}
            <Feature features={['organizations:performance-tag-page']}>
              <ListLink
                to={tagsTarget}
                isActive={() => currentTab === Tab.Tags}
                onClick={this.trackTagsTabClick}
              >
                {t('Tags')}
                <FeatureBadge type="beta" noTooltip />
              </ListLink>
            </Feature>
            <Feature features={['organizations:performance-events-page']}>
              <ListLink
                to={eventsTarget}
                isActive={() => currentTab === Tab.Events}
                onClick={this.trackEventsTabClick}
              >
                {t('All Events')}
                <FeatureBadge type="new" noTooltip />
              </ListLink>
            </Feature>
          </StyledNavTabs>
        </React.Fragment>
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
