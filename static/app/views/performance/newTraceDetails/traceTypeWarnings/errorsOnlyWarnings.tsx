import {useEffect, useMemo} from 'react';

import emptyTraceImg from 'sentry-images/spot/performance-empty-trace.svg';

import {withPerformanceOnboarding} from 'sentry/data/platformCategories';
import {t, tct} from 'sentry/locale';
import OnboardingDrawerStore, {
  OnboardingDrawerKey,
} from 'sentry/stores/onboardingDrawerStore';
import {DataCategoryExact} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {browserHistory} from 'sentry/utils/browserHistory';
import {useLocation} from 'sentry/utils/useLocation';
import useProjects from 'sentry/utils/useProjects';
import {traceAnalytics} from 'sentry/views/performance/newTraceDetails/traceAnalytics';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import {TraceShape} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import {getPricingDocsLinkForEventType} from 'sentry/views/settings/account/notifications/utils';

import {TraceWarningComponents} from './styles';
import {usePerformanceSubscriptionDetails} from './usePerformanceSubscriptionDetails';
import {usePerformanceUsageStats} from './usePerformanceUsageStats';

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
  const hideBanner =
    projectsWithNoPerformance.length === 0 ||
    projectsWithOnboardingChecklist.length === 0;

  useEffect(() => {
    if (hideBanner) {
      return;
    }

    traceAnalytics.trackPerformanceSetupBannerLoaded(organization);

    if (location.hash === '#performance-sidequest') {
      OnboardingDrawerStore.open(OnboardingDrawerKey.PERFORMANCE_ONBOARDING);
    }
  }, [projectsWithOnboardingChecklist, hideBanner, organization, location.hash]);

  if (hideBanner) {
    return null;
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
        OnboardingDrawerStore.open(OnboardingDrawerKey.PERFORMANCE_ONBOARDING);
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
  const {data: performanceUsageStats} = usePerformanceUsageStats({
    organization: props.organization,
    tree: props.tree,
  });

  const {
    data: {hasExceededPerformanceUsageLimit, subscription},
  } = usePerformanceSubscriptionDetails({traceItemDataset: 'default'});

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
      ? subscription.planDetails.budgetTerm
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
          pathname: '/checkout/?referrer=trace-view',
          query: {
            skipBundles: true,
          },
        });
      }}
      docsRoute={getPricingDocsLinkForEventType(
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
