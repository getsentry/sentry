import {Component, Fragment} from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import Feature from 'sentry/components/acl/feature';
import GuideAnchor from 'sentry/components/assistant/guideAnchor';
import ButtonBar from 'sentry/components/buttonBar';
import {CreateAlertFromViewButton} from 'sentry/components/createAlertButton';
import FeatureBadge from 'sentry/components/featureBadge';
import IdBadge from 'sentry/components/idBadge';
import * as Layout from 'sentry/components/layouts/thirds';
import ListLink from 'sentry/components/links/listLink';
import NavTabs from 'sentry/components/navTabs';
import ReplaysFeatureBadge from 'sentry/components/replays/replaysFeatureBadge';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization, Project} from 'sentry/types';
import {trackAnalyticsEvent} from 'sentry/utils/analytics';
import EventView from 'sentry/utils/discover/eventView';
import HasMeasurementsQuery from 'sentry/utils/performance/vitals/hasMeasurementsQuery';
import {decodeScalar} from 'sentry/utils/queryString';
import Breadcrumb from 'sentry/views/performance/breadcrumb';

import {getCurrentLandingDisplay, LandingDisplayField} from '../landing/utils';
import {getSelectedProjectPlatforms} from '../utils';

import {anomaliesRouteWithQuery} from './transactionAnomalies/utils';
import {eventsRouteWithQuery} from './transactionEvents/utils';
import {replaysRouteWithQuery} from './transactionReplays/utils';
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
  hasWebVitals: 'maybe' | 'yes' | 'no';
  location: Location;
  organization: Organization;
  projectId: string;
  projects: Project[];
  transactionName: string;
  onChangeThreshold?: (threshold: number, metric: TransactionThresholdMetric) => void;
};

class TransactionHeader extends Component<Props> {
  trackTabClick = (tab: Tab) => () => {
    const analyticKeys = TAB_ANALYTICS[tab];
    if (!analyticKeys) {
      return;
    }

    const {location, projects} = this.props;

    trackAnalyticsEvent({
      ...analyticKeys,
      organization_id: this.props.organization.id,
      project_platforms: getSelectedProjectPlatforms(location, projects),
    });
  };

  handleCreateAlertSuccess = () => {
    trackAnalyticsEvent({
      eventKey: 'performance_views.summary.create_alert_clicked',
      eventName: 'Performance Views: Create alert clicked',
      organization_id: this.props.organization.id,
    });
  };

  renderCreateAlertButton() {
    const {eventView, organization, projects} = this.props;

    return (
      <CreateAlertFromViewButton
        eventView={eventView}
        organization={organization}
        projects={projects}
        onClick={this.handleCreateAlertSuccess}
        referrer="performance"
        alertType="trans_duration"
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

  render() {
    const {organization, location, projectId, transactionName, currentTab, projects} =
      this.props;

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
    const replaysTarget = replaysRouteWithQuery(routeQuery);

    const project = projects.find(p => p.id === projectId);

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
          <Layout.Title>
            <TransactionName>
              {project && (
                <IdBadge
                  project={project}
                  avatarSize={28}
                  hideName
                  avatarProps={{hasTooltip: true, tooltip: project.slug}}
                />
              )}
              {transactionName}
            </TransactionName>
          </Layout.Title>
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
        <Fragment>
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
            <Feature features={['session-replay']} organization={organization}>
              <ListLink
                data-test-id="replays-tab"
                to={replaysTarget}
                isActive={() => currentTab === Tab.Replays}
                onClick={this.trackTabClick(Tab.Replays)}
              >
                {t('Replays')}
                <ReplaysFeatureBadge noTooltip />
              </ListLink>
            </Feature>
          </StyledNavTabs>
        </Fragment>
      </Layout.Header>
    );
  }
}

const StyledNavTabs = styled(NavTabs)`
  margin-bottom: 0;
  /* Makes sure the tabs are pushed into another row */
  width: 100%;
`;

const TransactionName = styled('div')`
  display: grid;
  grid-template-columns: max-content 1fr;
  grid-column-gap: ${space(1)};
  align-items: center;
`;

export default TransactionHeader;
