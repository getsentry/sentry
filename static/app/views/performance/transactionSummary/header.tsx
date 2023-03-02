import {useCallback, useMemo} from 'react';
import {Location} from 'history';

import Feature from 'sentry/components/acl/feature';
import GuideAnchor from 'sentry/components/assistant/guideAnchor';
import ButtonBar from 'sentry/components/buttonBar';
import {CreateAlertFromViewButton} from 'sentry/components/createAlertButton';
import IdBadge from 'sentry/components/idBadge';
import * as Layout from 'sentry/components/layouts/thirds';
import useReplaysCount from 'sentry/components/replays/useReplaysCount';
import {t} from 'sentry/locale';
import {Organization, Project} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import EventView from 'sentry/utils/discover/eventView';
import {MetricsCardinalityContext} from 'sentry/utils/performance/contexts/metricsCardinality';
import HasMeasurementsQuery from 'sentry/utils/performance/vitals/hasMeasurementsQuery';
import {isProfilingSupportedOrProjectHasProfiles} from 'sentry/utils/profiling/platforms';
import projectSupportsReplay from 'sentry/utils/replays/projectSupportsReplay';
import Breadcrumb from 'sentry/views/performance/breadcrumb';

import {getCurrentLandingDisplay, LandingDisplayField} from '../landing/utils';

import Tab from './pageLayout/tabs';
import TransactionSummaryTabs from './pageLayout/transactionSummaryTabs';
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
    trackAdvancedAnalyticsEvent('performance_views.summary.create_alert_clicked', {
      organization,
    });
  }

  const project = projects.find(p => p.id === projectId);

  const hasAnomalyDetection = organization.features?.includes(
    'performance-anomaly-detection-ui'
  );

  const hasSessionReplay =
    organization.features.includes('session-replay') &&
    project &&
    projectSupportsReplay(project);

  const hasProfiling =
    project &&
    organization.features.includes('profiling') &&
    isProfilingSupportedOrProjectHasProfiles(project);

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

  const projectIds = useMemo(
    () => (project?.id ? [Number(project.id)] : []),
    [project?.id]
  );

  const replaysCount = useReplaysCount({
    transactionNames: transactionName,
    organization,
    projectIds,
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
          {project && (
            <IdBadge
              project={project}
              avatarSize={28}
              hideName
              avatarProps={{hasTooltip: true, tooltip: project.slug}}
            />
          )}
          {transactionName}
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
            <TransactionSummaryTabs
              hasAnomalyDetection={hasAnomalyDetection}
              hasProfiling={!!hasProfiling}
              hasSessionReplay={!!hasSessionReplay}
              renderWebVitals={renderWebVitals}
              replaysCount={replaysCount}
            />
          );
        }}
      </HasMeasurementsQuery>
    </Layout.Header>
  );
}

export default TransactionHeader;
