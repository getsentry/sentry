import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {getSelectedProjectList} from 'sentry/utils/project/useSelectedProjectsHaveField';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import type {PrebuiltDashboardId} from 'sentry/views/dashboards/utils/prebuiltConfigs';
import {PREBUILT_DASHBOARDS} from 'sentry/views/dashboards/utils/prebuiltConfigs';
import * as ModuleLayout from 'sentry/views/insights/common/components/moduleLayout';
import {ModulesOnboardingPanel} from 'sentry/views/insights/common/components/modulesOnboarding';
import {useHasFirstSpan} from 'sentry/views/insights/common/queries/useHasFirstSpan';
import {useOnboardingProject} from 'sentry/views/insights/common/queries/useOnboardingProject';
import {useHasAgentSpans} from 'sentry/views/insights/pages/agents/hooks/useHasAgentSpans';
import {Onboarding as AgentOnboarding} from 'sentry/views/insights/pages/agents/onboarding';
import {Onboarding as MCPOnboarding} from 'sentry/views/insights/pages/mcp/onboarding';
import {NodeRuntimeMetricsOnboarding} from 'sentry/views/insights/pages/nodeRuntime/onboarding';
import {ModuleName} from 'sentry/views/insights/types';
import {LegacyOnboarding} from 'sentry/views/performance/onboarding';
import {useLLMContext} from 'sentry/views/seerExplorer/contexts/llmContext';
import {registerLLMContext} from 'sentry/views/seerExplorer/contexts/registerLLMContext';
import {
  toLLMContextProjectFields,
  useSelectedProjectsForLLMContext,
} from 'sentry/views/seerExplorer/utils/selectedProjectsForLLMContext';

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

  const prebuiltDashboard = prebuiltId ? PREBUILT_DASHBOARDS[prebuiltId] : undefined;
  const onboarding = prebuiltDashboard?.onboarding;

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
        <DashboardOnboarding title={prebuiltDashboard?.title}>
          <ModuleLayout.Full>
            <LegacyOnboarding organization={organization} project={onboardingProject} />
          </ModuleLayout.Full>
        </DashboardOnboarding>
      );
    }

    if (!hasFirstSpan) {
      return (
        <DashboardOnboarding title={prebuiltDashboard?.title}>
          <ModuleLayout.Full>
            <ModulesOnboardingPanel moduleName={onboarding.moduleName} />
          </ModuleLayout.Full>
        </DashboardOnboarding>
      );
    }

    return children;
  }

  if (onboarding.type === 'custom' && onboarding.componentId === 'agent-monitoring') {
    return (
      <AgentDashboardOnboardingGate title={prebuiltDashboard?.title}>
        {children}
      </AgentDashboardOnboardingGate>
    );
  }

  const selectedProjects = getSelectedProjectList(
    pageFilters.selection.projects,
    projects
  );

  const hasData = onboarding.requiredProjectFlags.some(flag =>
    selectedProjects.some(p => p[flag])
  );

  if (hasData) {
    return children;
  }

  if (onboarding.type === 'custom') {
    if (onboarding.componentId === 'node-runtime-metrics') {
      return (
        <DashboardOnboarding title={prebuiltDashboard?.title}>
          <NodeRuntimeMetricsOnboarding />
        </DashboardOnboarding>
      );
    }

    return (
      <DashboardOnboarding title={prebuiltDashboard?.title}>
        <MCPOnboarding />
      </DashboardOnboarding>
    );
  }

  return (
    <DashboardOnboarding title={prebuiltDashboard?.title}>
      <GenericOnboarding heading={onboarding.description} />
    </DashboardOnboarding>
  );
}

function AgentDashboardOnboardingGate({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string | undefined;
}) {
  const {hasAgenticSpans, isLoading, isError} = useHasAgentSpans();

  if (isLoading) {
    return <LoadingIndicator />;
  }

  // A failed availability check is not evidence that instrumentation is missing.
  if (hasAgenticSpans || isError) {
    return children;
  }

  return (
    <DashboardOnboarding title={title}>
      <AgentOnboarding />
    </DashboardOnboarding>
  );
}

function DashboardOnboardingInner({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string | undefined;
}) {
  const selectedProjects = useSelectedProjectsForLLMContext();

  useLLMContext({
    contextHint:
      'Sentry prebuilt dashboard. Shows setup instructions instead of widgets because the selected projects have not sent the data this dashboard needs yet. ' +
      'projectSelectionInstruction describes the page-filter project scope (explicit pins vs My/All Projects). ' +
      'When projectIds/projectSlugs are empty, that is expected for My/All Projects — follow projectSelectionInstruction.',
    onboarding: true,
    title,
    ...toLLMContextProjectFields(selectedProjects),
  });

  return children;
}

const DashboardOnboarding = registerLLMContext('dashboard', DashboardOnboardingInner);
