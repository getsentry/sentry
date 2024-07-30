import {useEffect, useMemo} from 'react';
import {browserHistory} from 'react-router';
import qs from 'qs';

import connectDotsImg from 'sentry-images/spot/performance-connect-dots.svg';

import {Alert} from 'sentry/components/alert';
import ExternalLink from 'sentry/components/links/externalLink';
import {SidebarPanelKey} from 'sentry/components/sidebar/types';
import {withPerformanceOnboarding} from 'sentry/data/platformCategories';
import {t, tct} from 'sentry/locale';
import SidebarPanelStore from 'sentry/stores/sidebarPanelStore';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import useProjects from 'sentry/utils/useProjects';

import {traceAnalytics} from '../traceAnalytics';
import type {TraceTree} from '../traceModels/traceTree';
import {TraceType} from '../traceType';

import GenericWarnings from './genericWarnings';
import {TraceWarningComponents} from './styles';

type OnlyOrphanErrorWarningsProps = {
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

export function PerformanceSetupWarning({
  traceSlug,
  tree,
  organization,
}: OnlyOrphanErrorWarningsProps) {
  const {projects} = useProjects();

  const {projectsWithNoPerformance, projectsWithOnboardingChecklist} = useMemo(() => {
    return filterProjects(projects, tree);
  }, [projects, tree]);

  const LOCAL_STORAGE_KEY = `${traceSlug}:performance-orphan-error-onboarding-banner-hide`;

  const hideBanner =
    tree.type !== 'trace' ||
    tree.shape !== TraceType.ONLY_ERRORS ||
    projectsWithNoPerformance.length === 0;

  useEffect(() => {
    if (hideBanner) {
      return;
    }

    traceAnalytics.trackPerformanceSetupBannerLoaded(organization);

    if (location.hash === '#performance-sidequest') {
      SidebarPanelStore.activatePanel(SidebarPanelKey.PERFORMANCE_ONBOARDING);
    }
  }, [projectsWithOnboardingChecklist, hideBanner, organization]);

  if (hideBanner) {
    return (
      <GenericWarnings organization={organization} traceSlug={traceSlug} tree={tree} />
    );
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
            ...qs.parse(location.search),
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
