import {useEffect, type ReactNode} from 'react';

import usePageFilters from 'sentry/components/pageFilters/usePageFilters';
import {getSelectedProjectList} from 'sentry/utils/project/useSelectedProjectsHaveField';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import type {PrebuiltDashboardId} from 'sentry/views/dashboards/utils/prebuiltConfigs';
import {PREBUILT_DASHBOARDS} from 'sentry/views/dashboards/utils/prebuiltConfigs';
import * as ModuleLayout from 'sentry/views/insights/common/components/moduleLayout';
import {ModulesOnboardingPanel} from 'sentry/views/insights/common/components/modulesOnboarding';
import {useHasFirstSpan} from 'sentry/views/insights/common/queries/useHasFirstSpan';
import {useOnboardingProject} from 'sentry/views/insights/common/queries/useOnboardingProject';
import {Onboarding as AgentOnboarding} from 'sentry/views/insights/pages/agents/onboarding';
import {Onboarding as MCPOnboarding} from 'sentry/views/insights/pages/mcp/onboarding';
import {ModuleName} from 'sentry/views/insights/types';
import {LegacyOnboarding} from 'sentry/views/performance/onboarding';

import {OverviewOnboardingPanel} from './overviewOnboardingPanel';

interface PrebuiltDashboardOnboardingGateProps {
  children: ReactNode;
  prebuiltId?: PrebuiltDashboardId;
}

/** Shows onboarding instead of dashboard widgets when the selected projects lack telemetry data. */
export function PrebuiltDashboardOnboardingGate({
  prebuiltId,
  children,
}: PrebuiltDashboardOnboardingGateProps) {
  const organization = useOrganization();
  const {projects, reloadProjects} = useProjects();
  const pageFilters = usePageFilters();
  const onboarding = prebuiltId ? PREBUILT_DASHBOARDS[prebuiltId]?.onboarding : undefined;

  const moduleName =
    onboarding?.type === 'module' ? onboarding.moduleName : ModuleName.OTHER;
  const onboardingProject = useOnboardingProject();
  const hasFirstSpan = useHasFirstSpan(moduleName);

  useEffect(() => {
    if (onboarding?.type === 'module' && !hasFirstSpan) {
      reloadProjects();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasFirstSpan]);

  if (!onboarding) {
    return children;
  }

  if (onboarding.type === 'module') {
    if (onboardingProject) {
      return (
        <ModuleLayout.Full>
          <LegacyOnboarding organization={organization} project={onboardingProject} />
        </ModuleLayout.Full>
      );
    }

    if (!hasFirstSpan) {
      return (
        <ModuleLayout.Full>
          <ModulesOnboardingPanel moduleName={onboarding.moduleName} />
        </ModuleLayout.Full>
      );
    }

    return children;
  }

  const selectedProjects = getSelectedProjectList(
    pageFilters.selection.projects,
    projects
  );

  const hasData = onboarding.requiredProjectFlags.some(flag =>
    selectedProjects.some(p => p[flag] === true)
  );

  if (hasData) {
    return children;
  }

  if (onboarding.type === 'overview') {
    return <OverviewOnboardingPanel heading={onboarding.description} />;
  }

  if (onboarding.componentId === 'agent-monitoring') {
    return <AgentOnboarding />;
  }

  return <MCPOnboarding />;
}
