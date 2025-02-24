import {useEffect, useMemo} from 'react';

import emptyTraceImg from 'sentry-images/spot/performance-empty-trace.svg';

import {Alert} from 'sentry/components/core/alert';
import ExternalLink from 'sentry/components/links/externalLink';
import {SidebarPanelKey} from 'sentry/components/sidebar/types';
import {withPerformanceOnboarding} from 'sentry/data/platformCategories';
import {t, tct} from 'sentry/locale';
import SidebarPanelStore from 'sentry/stores/sidebarPanelStore';
import {DataCategoryExact} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {browserHistory} from 'sentry/utils/browserHistory';
import {useLocation} from 'sentry/utils/useLocation';
import useProjects from 'sentry/utils/useProjects';
import {getDocsLinkForEventType} from 'sentry/views/settings/account/notifications/utils';

import {traceAnalytics} from '../traceAnalytics';
import type {TraceTree} from '../traceModels/traceTree';
import {TraceShape} from '../traceModels/traceTree';

import {TraceWarningComponents} from './styles';
import {usePerformanceSubscriptionDetails} from './usePerformanceSubscriptionDetails';
import {usePerformanceUsageStats} from './usePerformanceUsageStats';

// 1 hour in milliseconds
const ONE_HOUR = 60 * 60 * 1000;

type ErrorOnlyWarningsProps = {
  organization: Organization;
  traceSlug: string | undefined;
  tree: TraceTree;
};

function filterProjects(projects: Project[], tree: TraceTree) {
  const projectsWithNoPerformance: Project[] = [];
  const projectsWithOnboardingChecklist: Project[] = [];

  for (const project of projects) {
    const hasProject = tree.projects.has(Number(project.id));
    if (hasProject) {
      if (!project.firstTransactionEvent) {
        projectsWithNoPerformance.push(project);
        if (project.platform && withPerformanceOnboarding.has(project.platform)) {
          projectsWithOnboardingChecklist.push(project);
        }
      }
    }
  }

  return {projectsWithNoPerformance, projectsWithOnboardingChecklist};
}

type PerformanceSetupBannerProps = {
  projectsWithNoPerformance: Project[];
  projectsWithOnboardingChecklist: Project[];
} & ErrorOnlyWarningsProps;

function PerformanceSetupBanner({
  traceSlug,
  organization,
  projectsWithNoPerformance,
  projectsWithOnboardingChecklist,
}: PerformanceSetupBannerProps) {
  const location = useLocation();
  const LOCAL_STORAGE_KEY = `${traceSlug}:performance-orphan-error-onboarding-banner-hide`;
  const hideBanner = projectsWithNoPerformance.length === 0;

  useEffect(() => {
    if (hideBanner) {
      return;
    }

    traceAnalytics.trackPerformanceSetupBannerLoaded(organization);

    if (location.hash === '#performance-sidequest') {
      SidebarPanelStore.activatePanel(SidebarPanelKey.PERFORMANCE_ONBOARDING);
    }
  }, [projectsWithOnboardingChecklist, hideBanner, organization, location.hash]);

  if (hideBanner) {
    return null;
  }

  if (projectsWithOnboardingChecklist.length === 0) {
    return (
      <Alert.Container>
        <Alert type="info" showIcon>
          {tct(
            "Some of the projects associated with this trace aren't sending spans, so you're only getting a partial trace view. To learn how to enable tracing for all your projects, visit our [documentationLink].",
            {
              documentationLink: (
                <ExternalLink href="https://docs.sentry.io/product/performance/getting-started/">
                  {t('documentation')}
                </ExternalLink>
              ),
            }
          )}
        </Alert>
      </Alert.Container>
    );
  }

  return (
    <TraceWarningComponents.Banner
      title={t('Your setup is incomplete')}
      description={t(
        'Want to know why this string of errors happened? Configure tracing for your SDKs to see correlated events across your services.'
      )}
      image={emptyTraceImg}
      onPrimaryButtonClick={() => {
        traceAnalytics.trackPerformanceSetupChecklistTriggered(organization);
        browserHistory.replace({
          pathname: location.pathname,
          query: {
            ...location.query,
            project: projectsWithOnboardingChecklist.map(project => project.id),
          },
          hash: '#performance-sidequest',
        });
        SidebarPanelStore.activatePanel(SidebarPanelKey.PERFORMANCE_ONBOARDING);
      }}
      onSecondaryButtonClick={() =>
        traceAnalytics.trackPerformanceSetupLearnMoreClicked(organization)
      }
      localStorageKey={LOCAL_STORAGE_KEY}
      docsRoute="https://docs.sentry.io/product/performance/"
      organization={organization}
      primaryButtonText={t('Set Up Tracing')}
    />
  );
}

function PerformanceQuotaExceededWarning(props: ErrorOnlyWarningsProps) {
  const traceNode = props.tree.root.children[0];
  const traceStartDate = new Date(traceNode?.space?.[0]!);
  const traceEndDate = new Date(traceNode?.space?.[0]! + traceNode?.space?.[1]!);

  // Add 1 hour buffer to the trace start and end date.
  const start = traceNode
    ? new Date(traceStartDate.getTime() - ONE_HOUR).toISOString()
    : '';
  const end = traceNode ? new Date(traceEndDate.getTime() + ONE_HOUR).toISOString() : '';

  const {data: performanceUsageStats} = usePerformanceUsageStats({
    organization: props.organization,
    dateRange: {start, end},
    projectIds: Array.from(props.tree.projects.keys()),
  });

  const {
    data: {hasExceededPerformanceUsageLimit, subscription},
  } = usePerformanceSubscriptionDetails();

  // Check if events were dropped due to exceeding the transaction quota, around when the trace occurred.
  const droppedTransactionsCount = performanceUsageStats?.totals['sum(quantity)'] || 0;

  const hideBanner =
    droppedTransactionsCount === 0 ||
    !props.organization.features.includes('trace-view-quota-exceeded-banner') ||
    !hasExceededPerformanceUsageLimit;

  useEffect(() => {
    if (hideBanner) {
      return;
    }

    traceAnalytics.trackQuotaExceededBannerLoaded(props.organization, props.tree.shape);
  }, [hideBanner, props.organization, props.tree.shape]);

  if (hideBanner) {
    return null;
  }

  const title = tct("You've exceeded your [billingType]", {
    billingType: subscription?.onDemandBudgets?.enabled
      ? ['am1', 'am2'].includes(subscription.planTier)
        ? t('on-demand budget')
        : t('pay-as-you-go budget')
      : t('quota'),
  });

  const ctaText = subscription?.onDemandBudgets?.enabled
    ? t('Increase Budget')
    : t('Increase Volumes');

  return (
    <TraceWarningComponents.Banner
      localStorageKey={`${props.traceSlug}:transaction-usage-warning-banner-hide`}
      organization={props.organization}
      image={emptyTraceImg}
      title={title}
      description={tct(
        'Spans are being dropped. To start seeing traces with spans, increase your [billingType].',
        {
          billingType: subscription?.onDemandBudgets?.enabled ? t('budget') : t('quota'),
        }
      )}
      onSecondaryButtonClick={() => {
        traceAnalytics.trackQuotaExceededLearnMoreClicked(
          props.organization,
          props.tree.shape
        );
      }}
      onPrimaryButtonClick={() => {
        traceAnalytics.trackQuotaExceededIncreaseBudgetClicked(
          props.organization,
          props.tree.shape
        );
        browserHistory.push({
          pathname: `/settings/billing/checkout/?referrer=trace-view`,
          query: {
            skipBundles: true,
          },
        });
      }}
      docsRoute={getDocsLinkForEventType(
        subscription?.categories && 'spans' in subscription.categories
          ? DataCategoryExact.SPAN
          : DataCategoryExact.TRANSACTION
      )}
      primaryButtonText={ctaText}
    />
  );
}

export function ErrorsOnlyWarnings({
  traceSlug,
  tree,
  organization,
}: ErrorOnlyWarningsProps) {
  const {projects} = useProjects();

  const {projectsWithNoPerformance, projectsWithOnboardingChecklist} = useMemo(() => {
    return filterProjects(projects, tree);
  }, [projects, tree]);

  if (tree.type !== 'trace' || tree.shape !== TraceShape.ONLY_ERRORS) {
    return null;
  }

  return projectsWithNoPerformance.length > 0 ? (
    <PerformanceSetupBanner
      traceSlug={traceSlug}
      tree={tree}
      organization={organization}
      projectsWithNoPerformance={projectsWithNoPerformance}
      projectsWithOnboardingChecklist={projectsWithOnboardingChecklist}
    />
  ) : (
    <PerformanceQuotaExceededWarning
      traceSlug={traceSlug}
      tree={tree}
      organization={organization}
    />
  );
}
