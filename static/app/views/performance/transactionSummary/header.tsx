import {Fragment, useCallback} from 'react';
import styled from '@emotion/styled';
import type {Location} from 'history';

import Feature from 'sentry/components/acl/feature';
import GuideAnchor from 'sentry/components/assistant/guideAnchor';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {TabList} from 'sentry/components/core/tabs';
import {Tooltip} from 'sentry/components/core/tooltip';
import {CreateAlertFromViewButton} from 'sentry/components/createAlertButton';
import FeedbackButton from 'sentry/components/feedbackButton/feedbackButton';
import IdBadge from 'sentry/components/idBadge';
import * as Layout from 'sentry/components/layouts/thirds';
import ReplayCountBadge from 'sentry/components/replays/replayCountBadge';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import type EventView from 'sentry/utils/discover/eventView';
import type {MetricsCardinalityContext} from 'sentry/utils/performance/contexts/metricsCardinality';
import {isProfilingSupportedOrProjectHasProfiles} from 'sentry/utils/profiling/platforms';
import useReplayCountForTransactions from 'sentry/utils/replayCount/useReplayCountForTransactions';
import projectSupportsReplay from 'sentry/utils/replays/projectSupportsReplay';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {useNavigate} from 'sentry/utils/useNavigate';
import {deprecateTransactionAlerts} from 'sentry/views/insights/common/utils/hasEAPAlerts';
import {BackendHeader} from 'sentry/views/insights/pages/backend/backendPageHeader';
import {BACKEND_LANDING_SUB_PATH} from 'sentry/views/insights/pages/backend/settings';
import {FrontendHeader} from 'sentry/views/insights/pages/frontend/frontendPageHeader';
import {FRONTEND_LANDING_SUB_PATH} from 'sentry/views/insights/pages/frontend/settings';
import {MobileHeader} from 'sentry/views/insights/pages/mobile/mobilePageHeader';
import {MOBILE_LANDING_SUB_PATH} from 'sentry/views/insights/pages/mobile/settings';
import {useDomainViewFilters} from 'sentry/views/insights/pages/useFilters';
import Breadcrumb, {getTabCrumbs} from 'sentry/views/performance/breadcrumb';
import {useTransactionSummaryEAP} from 'sentry/views/performance/otlp/useTransactionSummaryEAP';
import {TAB_ANALYTICS} from 'sentry/views/performance/transactionSummary/pageLayout';
import {eventsRouteWithQuery} from 'sentry/views/performance/transactionSummary/transactionEvents/utils';
import {profilesRouteWithQuery} from 'sentry/views/performance/transactionSummary/transactionProfiles/utils';
import {replaysRouteWithQuery} from 'sentry/views/performance/transactionSummary/transactionReplays/utils';
import {tagsRouteWithQuery} from 'sentry/views/performance/transactionSummary/transactionTags/utils';
import {transactionSummaryRouteWithQuery} from 'sentry/views/performance/transactionSummary/utils';
import {getSelectedProjectPlatforms} from 'sentry/views/performance/utils';

import Tab from './tabs';
import TeamKeyTransactionButton from './teamKeyTransactionButton';
import TransactionThresholdButton from './transactionThresholdButton';
import type {TransactionThresholdMetric} from './transactionThresholdModal';

type Props = {
  currentTab: Tab;
  eventView: EventView;
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
}: Props) {
  const {isInDomainView, view} = useDomainViewFilters();
  const navigate = useNavigate();

  const getNewRoute = useCallback(
    (newTab: Tab) => {
      if (!transactionName) {
        return {};
      }

      const routeQuery = {
        organization,
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
        case Tab.REPLAYS:
          return replaysRouteWithQuery(routeQuery);
        case Tab.PROFILING: {
          return profilesRouteWithQuery(routeQuery);
        }
        case Tab.TRANSACTION_SUMMARY:
        default:
          return transactionSummaryRouteWithQuery(routeQuery);
      }
    },
    [location.query, organization, projectId, transactionName, view]
  );

  const onTabChange = useCallback(
    (newTab: string) => {
      // Prevent infinite rerenders
      if (newTab === currentTab) {
        return;
      }

      // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
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

  // Hard-code 90d for the replay tab to surface more interesting data.
  const {getReplayCountForTransaction} = useReplayCountForTransactions({
    statsPeriod: '90d',
  });
  const replaysCount = getReplayCountForTransaction(transactionName);

  const tabList = (
    <TabList
      outerWrapStyles={{
        gridColumn: '1 / -1',
      }}
    >
      <TabList.Item key={Tab.TRANSACTION_SUMMARY}>{t('Overview')}</TabList.Item>
      <TabList.Item key={Tab.EVENTS}>{t('Sampled Events')}</TabList.Item>
      <TabList.Item key={Tab.TAGS}>{t('Tags')}</TabList.Item>
      <TabList.Item key={Tab.REPLAYS} textValue={t('Replays')} hidden={!hasSessionReplay}>
        {t('Replays')}
        <ReplayCountBadge count={replaysCount} />
      </TabList.Item>
      <TabList.Item key={Tab.PROFILING} textValue={t('Profiling')} hidden={!hasProfiling}>
        {t('Profiles')}
      </TabList.Item>
    </TabList>
  );

  const shouldUseOTelFriendlyUI = useTransactionSummaryEAP();

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
        shouldUseOTelFriendlyUI,
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
        <ButtonBar>
          <Feature organization={organization} features="incidents">
            {({hasFeature}) =>
              hasFeature &&
              !metricsCardinality?.isLoading &&
              !deprecateTransactionAlerts(organization) ? (
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
          <FeedbackButton />
        </ButtonBar>
      </Layout.HeaderActions>
      <TabList
        outerWrapStyles={{
          gridColumn: '1 / -1',
        }}
      >
        <TabList.Item key={Tab.TRANSACTION_SUMMARY}>{t('Overview')}</TabList.Item>
        <TabList.Item key={Tab.EVENTS}>{t('Sampled Events')}</TabList.Item>
        <TabList.Item key={Tab.TAGS}>{t('Tags')}</TabList.Item>
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
      </TabList>
    </Layout.Header>
  );
}

const TransactionName = styled('div')`
  ${p => p.theme.overflowEllipsis}
`;

export default TransactionHeader;
