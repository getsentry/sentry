import {Fragment, useCallback} from 'react';
import styled from '@emotion/styled';
import type {Location} from 'history';

import Feature from 'sentry/components/acl/feature';
import GuideAnchor from 'sentry/components/assistant/guideAnchor';
import ButtonBar from 'sentry/components/buttonBar';
import {CreateAlertFromViewButton} from 'sentry/components/createAlertButton';
import FeedbackWidgetButton from 'sentry/components/feedback/widget/feedbackWidgetButton';
import IdBadge from 'sentry/components/idBadge';
import * as Layout from 'sentry/components/layouts/thirds';
import ReplayCountBadge from 'sentry/components/replays/replayCountBadge';
import {TabList} from 'sentry/components/tabs';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import type EventView from 'sentry/utils/discover/eventView';
import type {MetricsCardinalityContext} from 'sentry/utils/performance/contexts/metricsCardinality';
import HasMeasurementsQuery from 'sentry/utils/performance/vitals/hasMeasurementsQuery';
import {isProfilingSupportedOrProjectHasProfiles} from 'sentry/utils/profiling/platforms';
import useReplayCountForTransactions from 'sentry/utils/replayCount/useReplayCountForTransactions';
import projectSupportsReplay from 'sentry/utils/replays/projectSupportsReplay';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {useNavigate} from 'sentry/utils/useNavigate';
import {AiHeader} from 'sentry/views/insights/pages/ai/aiPageHeader';
import {AI_LANDING_SUB_PATH} from 'sentry/views/insights/pages/ai/settings';
import {BackendHeader} from 'sentry/views/insights/pages/backend/backendPageHeader';
import {BACKEND_LANDING_SUB_PATH} from 'sentry/views/insights/pages/backend/settings';
import {FrontendHeader} from 'sentry/views/insights/pages/frontend/frontendPageHeader';
import {FRONTEND_LANDING_SUB_PATH} from 'sentry/views/insights/pages/frontend/settings';
import {MobileHeader} from 'sentry/views/insights/pages/mobile/mobilePageHeader';
import {MOBILE_LANDING_SUB_PATH} from 'sentry/views/insights/pages/mobile/settings';
import {useDomainViewFilters} from 'sentry/views/insights/pages/useFilters';
import Breadcrumb, {getTabCrumbs} from 'sentry/views/performance/breadcrumb';
import {aggregateWaterfallRouteWithQuery} from 'sentry/views/performance/transactionSummary/aggregateSpanWaterfall/utils';
import {TAB_ANALYTICS} from 'sentry/views/performance/transactionSummary/pageLayout';
import {eventsRouteWithQuery} from 'sentry/views/performance/transactionSummary/transactionEvents/utils';
import {profilesRouteWithQuery} from 'sentry/views/performance/transactionSummary/transactionProfiles/utils';
import {replaysRouteWithQuery} from 'sentry/views/performance/transactionSummary/transactionReplays/utils';
import {spansRouteWithQuery} from 'sentry/views/performance/transactionSummary/transactionSpans/utils';
import {tagsRouteWithQuery} from 'sentry/views/performance/transactionSummary/transactionTags/utils';
import {transactionSummaryRouteWithQuery} from 'sentry/views/performance/transactionSummary/utils';
import {getSelectedProjectPlatforms} from 'sentry/views/performance/utils';

import {getCurrentLandingDisplay, LandingDisplayField} from '../landing/utils';

import Tab from './tabs';
import TeamKeyTransactionButton from './teamKeyTransactionButton';
import TransactionThresholdButton from './transactionThresholdButton';
import type {TransactionThresholdMetric} from './transactionThresholdModal';

export type Props = {
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
  const {isInDomainView, view} = useDomainViewFilters();
  const navigate = useNavigate();

  const getNewRoute = useCallback(
    (newTab: Tab) => {
      if (!transactionName) {
        return {};
      }

      const routeQuery = {
        orgSlug: organization.slug,
        transaction: transactionName,
        projectID: projectId,
        query: location.query,
        view,
      };

      switch (newTab) {
        case Tab.TAGS:
          return tagsRouteWithQuery(routeQuery);
        case Tab.EVENTS:
          return eventsRouteWithQuery(routeQuery);
        case Tab.SPANS:
          return spansRouteWithQuery(routeQuery);
        case Tab.REPLAYS:
          return replaysRouteWithQuery(routeQuery);
        case Tab.PROFILING: {
          return profilesRouteWithQuery(routeQuery);
        }
        case Tab.AGGREGATE_WATERFALL:
          return aggregateWaterfallRouteWithQuery(routeQuery);
        case Tab.TRANSACTION_SUMMARY:
        default:
          return transactionSummaryRouteWithQuery(routeQuery);
      }
    },
    [location.query, organization.slug, projectId, transactionName, view]
  );

  const onTabChange = useCallback(
    (newTab: string) => {
      // Prevent infinite rerenders
      if (newTab === currentTab) {
        return;
      }

      // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      const analyticsKey = TAB_ANALYTICS[newTab];
      if (analyticsKey) {
        trackAnalytics(analyticsKey, {
          organization,
          project_platforms: getSelectedProjectPlatforms(location, projects),
        });
      }

      navigate(normalizeUrl(getNewRoute(newTab as Tab)));
    },
    [getNewRoute, organization, location, projects, currentTab, navigate]
  );

  function handleCreateAlertSuccess() {
    trackAnalytics('performance_views.summary.create_alert_clicked', {
      organization,
    });
  }

  const project = projects.find(p => p.id === projectId);

  const hasSessionReplay =
    organization.features.includes('session-replay') &&
    project &&
    projectSupportsReplay(project);

  const hasProfiling =
    project &&
    organization.features.includes('profiling') &&
    isProfilingSupportedOrProjectHasProfiles(project);

  const hasAggregateWaterfall = organization.features.includes(
    'insights-initial-modules'
  );

  const getWebVitals = useCallback(
    (hasMeasurements: boolean) => {
      switch (hasWebVitals) {
        case 'maybe':
          // need to check if the web vitals tab should be shown

          // frontend projects should always show the web vitals tab
          if (
            getCurrentLandingDisplay(location, projects, eventView).field ===
            LandingDisplayField.FRONTEND_OTHER
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

  const {getReplayCountForTransaction} = useReplayCountForTransactions({
    statsPeriod: '90d',
  });
  const replaysCount = getReplayCountForTransaction(transactionName);

  const tabList = (
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
            <TabList.Item key={Tab.TRANSACTION_SUMMARY}>{t('Overview')}</TabList.Item>
            <TabList.Item key={Tab.EVENTS}>{t('Sampled Events')}</TabList.Item>
            <TabList.Item key={Tab.TAGS}>{t('Tags')}</TabList.Item>
            <TabList.Item key={Tab.SPANS}>{t('Spans')}</TabList.Item>
            <TabList.Item
              key={Tab.WEB_VITALS}
              textValue={t('Web Vitals')}
              hidden={!renderWebVitals}
            >
              {t('Web Vitals')}
            </TabList.Item>
            <TabList.Item
              key={Tab.REPLAYS}
              textValue={t('Replays')}
              hidden={!hasSessionReplay}
            >
              {t('Replays')}
              <ReplayCountBadge count={replaysCount} />
            </TabList.Item>
            <TabList.Item
              key={Tab.PROFILING}
              textValue={t('Profiling')}
              hidden={!hasProfiling}
            >
              {t('Profiles')}
            </TabList.Item>
            <TabList.Item
              key={Tab.AGGREGATE_WATERFALL}
              textValue={t('Aggregate Spans')}
              hidden={!hasAggregateWaterfall}
            >
              {t('Aggregate Spans')}
            </TabList.Item>
          </TabList>
        );
      }}
    </HasMeasurementsQuery>
  );

  if (isInDomainView) {
    const headerProps = {
      headerTitle: (
        <Fragment>
          {project && (
            <IdBadge
              project={project}
              avatarSize={28}
              hideName
              avatarProps={{hasTooltip: true, tooltip: project.slug}}
            />
          )}
          <Tooltip showOnlyOnOverflow skipWrapper title={transactionName}>
            <TransactionName>{transactionName}</TransactionName>
          </Tooltip>
        </Fragment>
      ),
      hideDefaultTabs: true,
      tabs: {
        onTabChange,
        tabList,
        value: currentTab,
      },
      breadcrumbs: getTabCrumbs({
        location,
        organization,
        transaction: {
          name: transactionName,
          project: projectId,
        },
        view,
      }),
      headerActions: (
        <Fragment>
          <Feature organization={organization} features="incidents">
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
            eventView={eventView}
            organization={organization}
            transactionName={transactionName}
          />
          <GuideAnchor target="project_transaction_threshold_override" position="bottom">
            <TransactionThresholdButton
              organization={organization}
              transactionName={transactionName}
              eventView={eventView}
              onChangeThreshold={onChangeThreshold}
            />
          </GuideAnchor>
        </Fragment>
      ),
    };
    if (view === FRONTEND_LANDING_SUB_PATH) {
      return <FrontendHeader {...headerProps} />;
    }
    if (view === BACKEND_LANDING_SUB_PATH) {
      return <BackendHeader {...headerProps} />;
    }
    if (view === AI_LANDING_SUB_PATH) {
      return <AiHeader {...headerProps} />;
    }
    if (view === MOBILE_LANDING_SUB_PATH) {
      return <MobileHeader {...headerProps} />;
    }
  }

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
          <Tooltip showOnlyOnOverflow skipWrapper title={transactionName}>
            <TransactionName>{transactionName}</TransactionName>
          </Tooltip>
        </Layout.Title>
      </Layout.HeaderContent>
      <Layout.HeaderActions>
        <ButtonBar gap={1}>
          <Feature organization={organization} features="incidents">
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
          <FeedbackWidgetButton />
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
              <TabList.Item key={Tab.TRANSACTION_SUMMARY}>{t('Overview')}</TabList.Item>
              <TabList.Item key={Tab.EVENTS}>{t('Sampled Events')}</TabList.Item>
              <TabList.Item key={Tab.TAGS}>{t('Tags')}</TabList.Item>
              <TabList.Item key={Tab.SPANS}>{t('Spans')}</TabList.Item>
              <TabList.Item
                key={Tab.WEB_VITALS}
                textValue={t('Web Vitals')}
                hidden={!renderWebVitals}
              >
                {t('Web Vitals')}
              </TabList.Item>
              <TabList.Item
                key={Tab.REPLAYS}
                textValue={t('Replays')}
                hidden={!hasSessionReplay}
              >
                {t('Replays')}
                <ReplayCountBadge count={replaysCount} />
              </TabList.Item>
              <TabList.Item
                key={Tab.PROFILING}
                textValue={t('Profiling')}
                hidden={!hasProfiling}
              >
                {t('Profiles')}
              </TabList.Item>
              <TabList.Item
                key={Tab.AGGREGATE_WATERFALL}
                textValue={t('Aggregate Spans')}
                hidden={!hasAggregateWaterfall}
              >
                {t('Aggregate Spans')}
              </TabList.Item>
            </TabList>
          );
        }}
      </HasMeasurementsQuery>
    </Layout.Header>
  );
}

const TransactionName = styled('div')`
  ${p => p.theme.overflowEllipsis}
`;

export default TransactionHeader;
