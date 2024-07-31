import {useEffect, useMemo} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';

import connectDotsImg from 'sentry-images/spot/performance-connect-dots.svg';
import waitingForSpansImg from 'sentry-images/spot/performance-waiting-for-span.svg';

import {Alert} from 'sentry/components/alert';
import ExternalLink from 'sentry/components/links/externalLink';
import {SidebarPanelKey} from 'sentry/components/sidebar/types';
import {withPerformanceOnboarding} from 'sentry/data/platformCategories';
import {t, tct} from 'sentry/locale';
import SidebarPanelStore from 'sentry/stores/sidebarPanelStore';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import useProjects from 'sentry/utils/useProjects';

import {traceAnalytics} from '../traceAnalytics';
import type {TraceTree} from '../traceModels/traceTree';
import {TraceType} from '../traceType';

import {TraceWarningComponents} from './styles';
import {useTransactionUsageStats} from './useTransactionUsageStats';

type ErrorOnlyWarningsProps = {
  organization: Organization;
  traceSlug: string | undefined;
  tree: TraceTree;
};

function filterProjects(projects: Project[], tree: TraceTree) {
  const projectsWithNoPerformance: Project[] = [];
  const projectsWithOnboardingChecklist: Project[] = [];

  for (const project of projects) {
    if (tree.project_ids.has(Number(project.id))) {
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
      <Alert type="info" showIcon>
        {tct(
          "Some of the projects associated with this trace don't support performance monitoring. To learn more about how to setup performance monitoring, visit our [documentation].",
          {
            documentationLink: (
              <ExternalLink href="https://docs.sentry.io/product/performance/getting-started/">
                {t('documentation')}
              </ExternalLink>
            ),
          }
        )}
      </Alert>
    );
  }

  return (
    <TraceWarningComponents.Banner
      title={t('Your setup is incomplete')}
      description={t(
        'Want to know why this string of errors happened? Configure tracing for your SDKs to see correlated events accross your services.'
      )}
      image={connectDotsImg}
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
      primaryButtonText={t('Start Checklist')}
    />
  );
}

type Subscription = {
  categories: {
    transactions: {
      usageExceeded: boolean;
    };
  };
  planDetails: {
    billingInterval: 'monthly' | 'annual';
    hasOnDemandModes: boolean;
  };
};

function PerformanceQuotaExceededWarning(props: ErrorOnlyWarningsProps) {
  const {data: transactionUsageStats} = useTransactionUsageStats({
    organization: props.organization,
    tree: props.tree,
  });

  const {data: subscription} = useApiQuery<Subscription>(
    [`/subscriptions/${props.organization.slug}/`],
    {
      staleTime: Infinity,
    }
  );

  // Check if events were dropped due to exceeding the transaction quota, around when the trace occurred.
  const droppedTransactionsCount = transactionUsageStats?.totals['sum(quantity)'] || 0;

  // Check if the organization still has transaction quota maxed out.
  const hasExceededTransactionLimit =
    subscription?.categories.transactions.usageExceeded || false;

  const hideBanner =
    droppedTransactionsCount === 0 ||
    !props.organization.features.includes('trace-view-quota-exceeded-banner') ||
    !hasExceededTransactionLimit;

  useEffect(() => {
    if (hideBanner) {
      return;
    }

    traceAnalytics.trackQuotaExceededBannerLoaded(props.organization, props.tree.shape);
  }, [hideBanner, props.organization, props.tree.shape]);

  if (hideBanner) {
    return null;
  }

  const title = tct("You've exceeded your [billingInterval] [billingType]", {
    billingInterval: subscription?.planDetails.billingInterval ?? 'monthly',
    billingType: subscription?.planDetails.hasOnDemandModes
      ? 'pay-as-you-go budget'
      : 'quota',
  });

  const ctaText = subscription?.planDetails?.hasOnDemandModes
    ? t('Increase Budget')
    : t('Set Budget');

  return (
    <Wrapper>
      <TraceWarningComponents.Banner
        localStorageKey={`${props.traceSlug}:transaction-usage-warning-banner-hide`}
        organization={props.organization}
        image={waitingForSpansImg}
        title={title}
        description={tct(
          'Spans are being dropped and monitoring is impacted. To start seeing traces with spans, [action] your budget.',
          {
            action: subscription?.planDetails?.hasOnDemandModes
              ? t('increase')
              : t('set'),
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
            pathname: `/settings/billing/checkout/`,
            query: {
              skipBundles: true,
            },
          });
        }}
        docsRoute="https://docs.sentry.io/pricing/quotas/"
        primaryButtonText={ctaText}
      />
    </Wrapper>
  );
}

const Wrapper = styled('div')`
  ${TraceWarningComponents.BannerBackground} {
    top: 4px;
    right: 40px;
    height: 98%;
    width: 100%;
    max-width: 270px;
  }
`;

export function ErrorsOnlyWarnings({
  traceSlug,
  tree,
  organization,
}: ErrorOnlyWarningsProps) {
  const {projects} = useProjects();

  const {projectsWithNoPerformance, projectsWithOnboardingChecklist} = useMemo(() => {
    return filterProjects(projects, tree);
  }, [projects, tree]);

  if (tree.type !== 'trace' || tree.shape !== TraceType.ONLY_ERRORS) {
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
