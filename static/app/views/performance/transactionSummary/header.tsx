import * as React from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';

import Feature from 'sentry/components/acl/feature';
import {GuideAnchor} from 'sentry/components/assistant/guideAnchor';
import ButtonBar from 'sentry/components/buttonBar';
import {CreateAlertFromViewButton} from 'sentry/components/createAlertButton';
import FeatureBadge from 'sentry/components/featureBadge';
import * as Layout from 'sentry/components/layouts/thirds';
import ListLink from 'sentry/components/links/listLink';
import NavTabs from 'sentry/components/navTabs';
import {t} from 'sentry/locale';
import {Organization, Project} from 'sentry/types';
import {trackAnalyticsEvent} from 'sentry/utils/analytics';
import EventView from 'sentry/utils/discover/eventView';
import HasMeasurementsQuery from 'sentry/utils/performance/vitals/hasMeasurementsQuery';
import {decodeScalar} from 'sentry/utils/queryString';
import Breadcrumb from 'sentry/views/performance/breadcrumb';

import {getCurrentLandingDisplay, LandingDisplayField} from '../landing/utils';
import {MetricsSwitch} from '../metricsSwitch';

import {anomaliesRouteWithQuery} from './transactionAnomalies/utils';
import {eventsRouteWithQuery} from './transactionEvents/utils';
import {spansRouteWithQuery} from './transactionSpans/utils';
import {tagsRouteWithQuery} from './transactionTags/utils';
import {vitalsRouteWithQuery} from './transactionVitals/utils';
import Tab from './tabs';
import TeamKeyTransactionButton from './teamKeyTransactionButton';
import TransactionThresholdButton from './transactionThresholdButton';
import {TransactionThresholdMetric} from './transactionThresholdModal';
import {transactionSummaryRouteWithQuery} from './utils';

type AnalyticInfo = {
  eventKey: string;
  eventName: string;
};

const TAB_ANALYTICS: Partial<Record<Tab, AnalyticInfo>> = {
  [Tab.WebVitals]: {
    eventKey: 'performance_views.vitals.vitals_tab_clicked',
    eventName: 'Performance Views: Vitals tab clicked',
  },
  [Tab.Tags]: {
    eventKey: 'performance_views.tags.tags_tab_clicked',
    eventName: 'Performance Views: Tags tab clicked',
  },
  [Tab.Events]: {
    eventKey: 'performance_views.events.events_tab_clicked',
    eventName: 'Performance Views: Events tab clicked',
  },
  [Tab.Spans]: {
    eventKey: 'performance_views.spans.spans_tab_clicked',
    eventName: 'Performance Views: Spans tab clicked',
  },
  [Tab.Anomalies]: {
    eventKey: 'performance_views.anomalies.anomalies_tab_clicked',
    eventName: 'Performance Views: Anomalies tab clicked',
  },
};

type Props = {
  currentTab: Tab;
  eventView: EventView;
  handleIncompatibleQuery: React.ComponentProps<
    typeof CreateAlertFromViewButton
  >['onIncompatibleQuery'];
  hasWebVitals: 'maybe' | 'yes' | 'no';
  location: Location;
  organization: Organization;
  projectId: string;
  projects: Project[];
  transactionName: string;
  onChangeThreshold?: (threshold: number, metric: TransactionThresholdMetric) => void;
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

  trackTabClick = (tab: Tab) => () => {
    const analyticKeys = TAB_ANALYTICS[tab];
    if (!analyticKeys) {
      return;
    }

    trackAnalyticsEvent({
      ...analyticKeys,
      organization_id: this.props.organization.id,
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
        aria-label={t('Create Alert')}
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
      <GuideAnchor target="project_transaction_threshold_override" position="bottom">
        <TransactionThresholdButton
          organization={organization}
          transactionName={transactionName}
          eventView={eventView}
          onChangeThreshold={onChangeThreshold}
        />
      </GuideAnchor>
    );
  }

  renderWebVitalsTab() {
    const {
      organization,
      eventView,
      location,
      projects,
      transactionName,
      currentTab,
      hasWebVitals,
    } = this.props;

    const vitalsTarget = vitalsRouteWithQuery({
      orgSlug: organization.slug,
      transaction: transactionName,
      projectID: decodeScalar(location.query.project),
      query: location.query,
    });

    const tab = (
      <ListLink
        data-test-id="web-vitals-tab"
        to={vitalsTarget}
        isActive={() => currentTab === Tab.WebVitals}
        onClick={this.trackTabClick(Tab.WebVitals)}
      >
        {t('Web Vitals')}
      </ListLink>
    );

    switch (hasWebVitals) {
      case 'maybe':
        // need to check if the web vitals tab should be shown

        // frontend projects should always show the web vitals tab
        if (
          getCurrentLandingDisplay(location, projects, eventView).field ===
          LandingDisplayField.FRONTEND_PAGELOAD
        ) {
          return tab;
        }

        // if it is not a frontend project, then we check to see if there
        // are any web vitals associated with the transaction recently
        return (
          <HasMeasurementsQuery
            location={location}
            orgSlug={organization.slug}
            eventView={eventView}
            transaction={transactionName}
            type="web"
          >
            {({hasMeasurements}) => (hasMeasurements ? tab : null)}
          </HasMeasurementsQuery>
        );
      case 'yes':
        // always show the web vitals tab
        return tab;
      case 'no':
      default:
        // never show the web vitals tab
        return null;
    }
  }

  handleSwitchMetrics = () => {
    const {location} = this.props;
    browserHistory.push({
      pathname: location.pathname,
      query: {
        ...location.query,
        query: undefined,
      },
    });
  };

  render() {
    const {organization, location, projectId, transactionName, currentTab} = this.props;

    const routeQuery = {
      orgSlug: organization.slug,
      transaction: transactionName,
      projectID: projectId,
      query: location.query,
    };

    const summaryTarget = transactionSummaryRouteWithQuery(routeQuery);
    const tagsTarget = tagsRouteWithQuery(routeQuery);
    const eventsTarget = eventsRouteWithQuery(routeQuery);
    const spansTarget = spansRouteWithQuery(routeQuery);
    const anomaliesTarget = anomaliesRouteWithQuery(routeQuery);

    return (
      <Layout.Header>
        <Layout.HeaderContent>
          <Breadcrumb
            organization={organization}
            location={location}
            transaction={{
              project: projectId,
              name: transactionName,
            }}
            tab={currentTab}
          />
          <Layout.Title>{transactionName}</Layout.Title>
        </Layout.HeaderContent>
        <Layout.HeaderActions>
          <ButtonBar gap={1}>
            <MetricsSwitch onSwitch={this.handleSwitchMetrics} />
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
            <ListLink
              to={eventsTarget}
              isActive={() => currentTab === Tab.Events}
              onClick={this.trackTabClick(Tab.Events)}
            >
              {t('All Events')}
            </ListLink>
            <ListLink
              to={tagsTarget}
              isActive={() => currentTab === Tab.Tags}
              onClick={this.trackTabClick(Tab.Tags)}
            >
              {t('Tags')}
            </ListLink>
            <Feature
              organization={organization}
              features={['organizations:performance-suspect-spans-view']}
            >
              <ListLink
                data-test-id="spans-tab"
                to={spansTarget}
                isActive={() => currentTab === Tab.Spans}
                onClick={this.trackTabClick(Tab.Spans)}
              >
                {t('Spans')}
                <FeatureBadge type="new" noTooltip />
              </ListLink>
            </Feature>
            <Feature
              organization={organization}
              features={['organizations:performance-anomaly-detection-ui']}
            >
              <ListLink
                data-test-id="anomalies-tab"
                to={anomaliesTarget}
                isActive={() => currentTab === Tab.Anomalies}
                onClick={this.trackTabClick(Tab.Anomalies)}
              >
                {t('Anomalies')}
                <FeatureBadge type="alpha" noTooltip />
              </ListLink>
            </Feature>
            {this.renderWebVitalsTab()}
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
