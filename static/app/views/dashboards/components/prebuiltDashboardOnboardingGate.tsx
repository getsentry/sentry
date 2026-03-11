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

import {GenericOnboarding} from './genericOnboarding';

interface PrebuiltDashboardOnboardingGateProps {
  children: React.ReactNode;
  prebuiltId?: PrebuiltDashboardId;
}

export function PrebuiltDashboardOnboardingGate({
  prebuiltId,
  children,
}: PrebuiltDashboardOnboardingGateProps) {
  const organization = useOrganization();
  const {projects} = useProjects();
  const pageFilters = usePageFilters();

  const onboarding = prebuiltId ? PREBUILT_DASHBOARDS[prebuiltId]?.onboarding : undefined;

  const moduleName =
    onboarding?.type === 'module' ? onboarding.moduleName : ModuleName.OTHER;

  // First project that doesn't have any span data at all
  const onboardingProject = useOnboardingProject();
  const hasAnySpanData = !onboardingProject;

  // Whether the selected projects have span of the required type
  const hasFirstSpan = useHasFirstSpan(moduleName);

  if (!onboarding) {
    return children;
  }

  // If the dashboard uses module-specific onboarding, check whether
  // module-specific data is available
  if (onboarding.type === 'module') {
    if (!hasAnySpanData) {
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

  if (onboarding.type === 'custom') {
    if (onboarding.componentId === 'agent-monitoring') {
      return <AgentOnboarding />;
    }

    return <MCPOnboarding />;
  }

  return <GenericOnboarding heading={onboarding.description} />;
}
