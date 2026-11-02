import type {
  Docs,
  DocsParams,
  OnboardingConfig,
  OnboardingStep,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {DocsPageLocation} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {useSourcePackageRegistries} from 'sentry/components/onboarding/gettingStartedDoc/useSourcePackageRegistries';
import {useLoadGettingStarted} from 'sentry/components/onboarding/gettingStartedDoc/utils/useLoadGettingStarted';
import {agentMonitoringPlatforms} from 'sentry/data/platformCategories';
import {otherPlatform, allPlatforms as platforms} from 'sentry/data/platforms';
import {ConfigStore} from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import type {Project, ProjectKey} from 'sentry/types/project';
import {useApi} from 'sentry/utils/useApi';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useAgentOnboardingOptions} from 'sentry/views/insights/pages/agents/utils/useAgentOnboardingOptions';
import {useOnboardingProject} from 'sentry/views/insights/pages/onboardingUtils';

type AgentOnboardingOptions = ReturnType<typeof useAgentOnboardingOptions>;

export type ReadyAgentOnboardingSetup = AgentOnboardingOptions & {
  configureSteps: OnboardingStep[];
  dsn: ProjectKey['dsn'];
  installSteps: OnboardingStep[];
  introduction: React.ReactNode;
  project: Project;
  status: 'ready';
  verifySteps: OnboardingStep[];
  sdkImportSpecifier?: string;
};

export type AgentOnboardingSetup =
  | {status: 'no-project'}
  | {project: Project; status: 'loading'}
  | {
      platformName: string;
      project: Project;
      status: 'unsupported';
      dsn?: ProjectKey['dsn'];
    }
  | {project: Project; status: 'no-docs'; dsn?: ProjectKey['dsn']}
  | ReadyAgentOnboardingSetup;

/**
 * Resolves everything the agent onboarding pages need to render the setup
 * instructions for the selected project: the integration and runtime options,
 * and the agent monitoring docs steps for the current selection.
 */
export function useAgentOnboardingSetup(): AgentOnboardingSetup {
  const api = useApi();
  const {isSelfHosted, urlPrefix} = useLegacyStore(ConfigStore);
  const project = useOnboardingProject();
  const organization = useOrganization();

  const currentPlatform = project?.platform
    ? platforms.find(p => p.id === project.platform)
    : undefined;

  const gettingStarted = useLoadGettingStarted({
    platform: currentPlatform || otherPlatform,
    orgSlug: organization.slug,
    projSlug: project?.slug,
  });
  const {isLoading, dsn, projectKeyId} = gettingStarted;
  const docs: Docs | null = gettingStarted.docs;

  const options = useAgentOnboardingOptions({
    platform: project?.platform,
    platformInfo: currentPlatform,
  });

  const {isPending: isLoadingRegistry, data: registryData} =
    useSourcePackageRegistries(organization);

  if (!project) {
    return {status: 'no-project'};
  }

  if (isLoading) {
    return {status: 'loading', project};
  }

  if (!project.platform || !agentMonitoringPlatforms.has(project.platform)) {
    return {
      status: 'unsupported',
      project,
      platformName: currentPlatform?.name || project.slug,
      dsn,
    };
  }

  const agentMonitoringDocs: OnboardingConfig | undefined =
    docs?.agentMonitoringOnboarding;

  if (!agentMonitoringDocs || !dsn || !projectKeyId) {
    return {status: 'no-docs', project, dsn};
  }

  const docParams: DocsParams = {
    api,
    projectKeyId,
    dsn,
    organization,
    platformKey: project.platform,
    project,
    isLogsSelected: false,
    isFeedbackSelected: false,
    isMetricsSelected: false,
    isPerformanceSelected: true,
    isProfilingSelected: false,
    isReplaySelected: false,
    sourcePackageRegistries: {
      isLoading: isLoadingRegistry,
      data: registryData,
    },
    platformOptions: {
      ...options.selectedPlatformOptions,
      ...(options.deploymentTarget && {deploymentTarget: options.deploymentTarget}),
    },
    docsLocation: DocsPageLocation.PROFILING_PAGE,
    urlPrefix,
    isSelfHosted,
  };

  return {
    ...options,
    status: 'ready',
    project,
    dsn,
    introduction: agentMonitoringDocs.introduction?.(docParams),
    sdkImportSpecifier: agentMonitoringDocs.sdkImportSpecifier?.(docParams),
    installSteps: agentMonitoringDocs.install?.(docParams) || [],
    configureSteps: agentMonitoringDocs.configure?.(docParams) || [],
    verifySteps: agentMonitoringDocs.verify?.(docParams) || [],
  };
}
