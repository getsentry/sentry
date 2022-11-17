import {useCallback} from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import Feature from 'sentry/components/acl/feature';
import GuideAnchor from 'sentry/components/assistant/guideAnchor';
import ButtonBar from 'sentry/components/buttonBar';
import {CreateAlertFromViewButton} from 'sentry/components/createAlertButton';
import FeatureBadge from 'sentry/components/featureBadge';
import IdBadge from 'sentry/components/idBadge';
import * as Layout from 'sentry/components/layouts/thirds';
import ReplayCountBadge from 'sentry/components/replays/replayCountBadge';
import ReplaysFeatureBadge from 'sentry/components/replays/replaysFeatureBadge';
import useReplaysCount from 'sentry/components/replays/useReplaysCount';
import {Item, TabList} from 'sentry/components/tabs';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization, Project} from 'sentry/types';
import {trackAnalyticsEvent} from 'sentry/utils/analytics';
import EventView from 'sentry/utils/discover/eventView';
import {MetricsCardinalityContext} from 'sentry/utils/performance/contexts/metricsCardinality';
import HasMeasurementsQuery from 'sentry/utils/performance/vitals/hasMeasurementsQuery';
import projectSupportsReplay from 'sentry/utils/replays/projectSupportsReplay';
import Breadcrumb from 'sentry/views/performance/breadcrumb';

import {getCurrentLandingDisplay, LandingDisplayField} from '../landing/utils';

import Tab from './tabs';
import TeamKeyTransactionButton from './teamKeyTransactionButton';
import TransactionThresholdButton from './transactionThresholdButton';
import {TransactionThresholdMetric} from './transactionThresholdModal';

type Props = {
  currentTab: Tab;
  eventView: EventView;
  hasWebVitals: 'maybe' | 'yes' | 'no';
  location: Location;
  organization: Organization;
  projectId: string;
  projects: Project[];
  transactionName: string;
  metricsCardinality?: MetricsCardinalityContext;
  onChangeThreshold?: (threshold: number, metric: TransactionThresholdMetric) => void;
};

function TransactionHeader({
  eventView,
  organization,
  projects,
  projectId,
  metricsCardinality,
  location,
  transactionName,
  onChangeThreshold,
  currentTab,
  hasWebVitals,
}: Props) {
  function handleCreateAlertSuccess() {
    trackAnalyticsEvent({
      eventKey: 'performance_views.summary.create_alert_clicked',
      eventName: 'Performance Views: Create alert clicked',
      organization_id: organization.id,
    });
  }

  const project = projects.find(p => p.id === projectId);

  const hasAnomalyDetection = organization.features?.includes(
    'performance-anomaly-detection-ui'
  );

  const hasSessionReplay =
    organization.features.includes('session-replay-ui') && projectSupportsReplay(project);

  const getWebVitals = useCallback(
    (hasMeasurements: boolean) => {
      switch (hasWebVitals) {
        case 'maybe':
          // need to check if the web vitals tab should be shown

          // frontend projects should always show the web vitals tab
          if (
            getCurrentLandingDisplay(location, projects, eventView).field ===
            LandingDisplayField.FRONTEND_PAGELOAD
          ) {
            return true;
          }

          // if it is not a frontend project, then we check to see if there
          // are any web vitals associated with the transaction recently
          return hasMeasurements;
        case 'yes':
          // always show the web vitals tab
          return true;
        case 'no':
        default:
          // never show the web vitals tab
          return false;
      }
    },
    [hasWebVitals, location, projects, eventView]
  );

  const replaysCount = useReplaysCount({
    transactionNames: transactionName,
    organization,
    project,
  })[transactionName];

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
            {({hasFeature}) =>
              hasFeature && !metricsCardinality?.isLoading ? (
                <CreateAlertFromViewButton
                  size="sm"
                  eventView={eventView}
                  organization={organization}
                  projects={projects}
                  onClick={handleCreateAlertSuccess}
                  referrer="performance"
                  alertType="trans_duration"
                  aria-label={t('Create Alert')}
                  disableMetricDataset={
                    metricsCardinality?.outcome?.forceTransactionsOnly
                  }
                />
              ) : null
            }
          </Feature>
          <TeamKeyTransactionButton
            transactionName={transactionName}
            eventView={eventView}
            organization={organization}
          />
          <GuideAnchor target="project_transaction_threshold_override" position="bottom">
            <TransactionThresholdButton
              organization={organization}
              transactionName={transactionName}
              eventView={eventView}
              onChangeThreshold={onChangeThreshold}
            />
          </GuideAnchor>
        </ButtonBar>
      </Layout.HeaderActions>
      <HasMeasurementsQuery
        location={location}
        orgSlug={organization.slug}
        eventView={eventView}
        transaction={transactionName}
        type="web"
      >
        {({hasMeasurements}) => {
          const renderWebVitals = getWebVitals(!!hasMeasurements);

          return (
            <TabList
              hideBorder
              outerWrapStyles={{
                gridColumn: '1 / -1',
              }}
            >
              <Item key={Tab.TransactionSummary}>{t('Overview')}</Item>
              <Item key={Tab.Events}>{t('All Events')}</Item>
              <Item key={Tab.Tags}>{t('Tags')}</Item>
              <Item key={Tab.Spans}>{t('Spans')}</Item>
              <Item
                key={Tab.Anomalies}
                textValue={t('Anomalies')}
                hidden={!hasAnomalyDetection}
              >
                {t('Anomalies')}
                <FeatureBadge type="alpha" noTooltip />
              </Item>
              <Item
                key={Tab.WebVitals}
                textValue={t('Web Vitals')}
                hidden={!renderWebVitals}
              >
                {t('Web Vitals')}
              </Item>
              <Item key={Tab.Replays} textValue={t('Replays')} hidden={!hasSessionReplay}>
                {t('Replays')}
                <ReplayCountBadge count={replaysCount} />
                <ReplaysFeatureBadge noTooltip />
              </Item>
            </TabList>
          );
        }}
      </HasMeasurementsQuery>
    </Layout.Header>
  );
}

const TransactionName = styled('div')`
  display: grid;
  grid-template-columns: max-content 1fr;
  grid-column-gap: ${space(1)};
  align-items: center;
`;

export default TransactionHeader;
