import type {ReactNode} from 'react';

import usePageFilters from 'sentry/components/pageFilters/usePageFilters';
import {getSelectedProjectList} from 'sentry/utils/project/useSelectedProjectsHaveField';
import useProjects from 'sentry/utils/useProjects';
import type {PrebuiltDashboardId} from 'sentry/views/dashboards/utils/prebuiltConfigs';
import {PREBUILT_DASHBOARDS} from 'sentry/views/dashboards/utils/prebuiltConfigs';
import {ModulesOnboarding} from 'sentry/views/insights/common/components/modulesOnboarding';
import {Onboarding as AgentOnboarding} from 'sentry/views/insights/pages/agents/onboarding';
import {Onboarding as MCPOnboarding} from 'sentry/views/insights/pages/mcp/onboarding';

import {OverviewOnboardingPanel} from './overviewOnboardingPanel';

/** Shows onboarding instead of dashboard widgets when the selected projects lack telemetry data. */
export function PrebuiltDashboardOnboardingGate({
  prebuiltId,
  children,
}: {
  children: ReactNode;
  prebuiltId?: PrebuiltDashboardId;
}) {
  const {projects} = useProjects();
  const pageFilters = usePageFilters();
  const onboarding = prebuiltId ? PREBUILT_DASHBOARDS[prebuiltId]?.onboarding : undefined;

  if (!onboarding) {
    return children;
  }

  if (onboarding.type === 'module') {
    return (
      <ModulesOnboarding moduleName={onboarding.moduleName}>{children}</ModulesOnboarding>
    );
  }

  const selectedProjects = getSelectedProjectList(
    pageFilters.selection.projects,
    projects
  );

  const hasData = onboarding.projectFlags.some(flag =>
    selectedProjects.some(p => p[flag] === true)
  );

  if (hasData) {
    return children;
  }

  if (onboarding.type === 'overview') {
    return <OverviewOnboardingPanel description={onboarding.description} />;
  }

  if (onboarding.componentId === 'agent-monitoring') {
    return <AgentOnboarding />;
  }

  return <MCPOnboarding />;
}
