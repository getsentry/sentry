import {useEffect, useState} from 'react';
import styled from '@emotion/styled';
import {PlatformIcon} from 'platformicons';

import replayOnboardingImg from 'sentry-images/spot/replay-inline-onboarding-v2.svg';

import {Button} from '@sentry/scraps/button';
import {ExternalLink} from '@sentry/scraps/link';

import {GuidedSteps} from 'sentry/components/guidedSteps/guidedSteps';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {AuthTokenGeneratorProvider} from 'sentry/components/onboarding/gettingStartedDoc/authTokenGenerator';
import {ContentBlocksRenderer} from 'sentry/components/onboarding/gettingStartedDoc/contentBlocks/renderer';
import type {ContentBlock} from 'sentry/components/onboarding/gettingStartedDoc/contentBlocks/types';
import {
  OnboardingCopyMarkdownButton,
  useCopySetupInstructionsEnabled,
} from 'sentry/components/onboarding/gettingStartedDoc/onboardingCopyMarkdownButton';
import {
  StepIndexProvider,
  TabSelectionScope,
} from 'sentry/components/onboarding/gettingStartedDoc/selectedCodeTabContext';
import {StepTitles} from 'sentry/components/onboarding/gettingStartedDoc/step';
import type {
  DocsParams,
  OnboardingStep,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {DocsPageLocation} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {useSourcePackageRegistries} from 'sentry/components/onboarding/gettingStartedDoc/useSourcePackageRegistries';
import {useLoadGettingStarted} from 'sentry/components/onboarding/gettingStartedDoc/utils/useLoadGettingStarted';
import {PlatformOptionDropdown} from 'sentry/components/onboarding/platformOptionDropdown';
import {useUrlPlatformOptions} from 'sentry/components/onboarding/platformOptionsControl';
import usePageFilters from 'sentry/components/pageFilters/usePageFilters';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import {SetupTitle} from 'sentry/components/updatedEmptyState';
import {
  agentMonitoringPlatforms,
  javascriptMetaFrameworks,
} from 'sentry/data/platformCategories';
import platforms, {otherPlatform} from 'sentry/data/platforms';
import {t, tct} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import pulsingIndicatorStyles from 'sentry/styles/pulsingIndicator';
import {space} from 'sentry/styles/space';
import type {PlatformKey, Project} from 'sentry/types/project';
import {getSelectedProjectList} from 'sentry/utils/project/useSelectedProjectsHaveField';
import {decodeInteger} from 'sentry/utils/queryString';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {useSpans} from 'sentry/views/insights/common/queries/useDiscover';
import {CopyLLMPromptButton} from 'sentry/views/insights/pages/agents/llmOnboardingInstructions';
import {
  AGENT_INTEGRATION_ICONS,
  AGENT_INTEGRATION_LABELS,
  AgentIntegration,
  NODE_AGENT_INTEGRATIONS,
  PYTHON_AGENT_INTEGRATIONS,
} from 'sentry/views/insights/pages/agents/utils/agentIntegrations';
import {Referrer} from 'sentry/views/insights/pages/agents/utils/referrers';

const serverSideNodeIntegrations = new Set([
  AgentIntegration.VERCEL_AI,
  AgentIntegration.MASTRA,
]);

const PYTHON_AUTO_CONVERSATION_ID: Set<string> = new Set([
  AgentIntegration.OPENAI_AGENTS,
]);
const NODE_AUTO_CONVERSATION_ID: Set<string> = new Set([AgentIntegration.OPENAI]);

function needsManualConversationId(integration: string, isPython: boolean): boolean {
  const autoSet = isPython ? PYTHON_AUTO_CONVERSATION_ID : NODE_AUTO_CONVERSATION_ID;
  return !autoSet.has(integration);
}

function useOnboardingProject() {
  const {projects} = useProjects();
  const pageFilters = usePageFilters();
  const selectedProjects = getSelectedProjectList(
    pageFilters.selection.projects,
    projects
  );
  const agentMonitoringProjects = selectedProjects.filter(p =>
    agentMonitoringPlatforms.has(p.platform as PlatformKey)
  );

  if (agentMonitoringProjects.length > 0) {
    return agentMonitoringProjects[0];
  }
  return selectedProjects[0];
}

function useConversationSpanWaiter(project: Project) {
  const {selection} = usePageFilters();
  const [shouldRefetch, setShouldRefetch] = useState(true);

  const request = useSpans(
    {
      search: 'has:gen_ai.conversation.id',
      fields: ['id'],
      limit: 1,
      enabled: !!project,
      useQueryOptions: {
        refetchInterval: shouldRefetch ? 5000 : undefined,
      },
      pageFilters: {
        ...selection,
        projects: [Number(project.id)],
        datetime: {
          period: '6h',
          utc: true,
          start: null,
          end: null,
        },
      },
    },
    Referrer.CONVERSATIONS_ONBOARDING
  );

  const hasEvents = Boolean(request.data?.length);

  useEffect(() => {
    if (hasEvents && shouldRefetch) {
      setShouldRefetch(false);
    }
  }, [hasEvents, shouldRefetch]);

  return request;
}

function ConversationWaitingIndicator({project}: {project: Project}) {
  const spanRequest = useConversationSpanWaiter(project);
  const {reloadProjects, fetching} = useProjects();
  const hasEvents = Boolean(spanRequest.data?.length);

  return hasEvents ? (
    <Button priority="primary" busy={fetching} onClick={reloadProjects}>
      {t('View Conversations')}
    </Button>
  ) : (
    <EventWaitingIndicator />
  );
}

function ConversationStepRenderer({
  project,
  step,
  stepIndex,
  isLastStep,
  trailingItems,
}: {
  isLastStep: boolean;
  project: Project;
  step: OnboardingStep;
  stepIndex: number;
  trailingItems?: React.ReactNode;
}) {
  return (
    <GuidedSteps.Step
      stepKey={step.type || step.title}
      title={step.title || (step.type && StepTitles[step.type])}
      trailingItems={trailingItems}
    >
      <StepIndexProvider index={stepIndex}>
        <ContentBlocksRenderer spacing={space(1)} contentBlocks={step.content} />
      </StepIndexProvider>
      <GuidedSteps.ButtonWrapper>
        <GuidedSteps.BackButton size="md" />
        <GuidedSteps.NextButton size="md" />
        {isLastStep && <ConversationWaitingIndicator project={project} />}
      </GuidedSteps.ButtonWrapper>
      {isLastStep && <PulseSpacer />}
    </GuidedSteps.Step>
  );
}

function ConversationOnboardingPanel({
  project,
  children,
}: {
  children: React.ReactNode;
  project: Project;
}) {
  return (
    <Panel>
      <PanelBody>
        <AuthTokenGeneratorProvider projectSlug={project?.slug}>
          <TabSelectionScope>
            <div>
              <Header>
                <HeaderText>
                  <Title>{t('See Exactly What Your Agent Said')}</Title>
                  <SubTitle>
                    {t(
                      "Replay every message, tool call, and handoff in a conversation. When your agent goes off-script, you'll know why."
                    )}
                  </SubTitle>
                  <BulletList>
                    <li>
                      {t('Follow the full thread of messages between users and agents')}
                    </li>
                    <li>
                      {t('Inspect tool calls, handoffs, and model responses in context')}
                    </li>
                    <li>
                      {t('Pinpoint where conversations went wrong with detailed traces')}
                    </li>
                  </BulletList>
                </HeaderText>
                <HeaderImage src={replayOnboardingImg} />
              </Header>
              <Divider />
              <SetupContent>{children}</SetupContent>
            </div>
          </TabSelectionScope>
        </AuthTokenGeneratorProvider>
      </PanelBody>
    </Panel>
  );
}

function getConversationIdStep(_integration: string, isPython: boolean): OnboardingStep {
  const content: ContentBlock[] = isPython
    ? [
        {
          type: 'text',
          text: t(
            'Group related LLM calls into a single conversation thread by setting an ID at the start:'
          ),
        },
        {
          type: 'code',
          language: 'python',
          code: `import sentry_sdk

# Call this at the start of each conversation
sentry_sdk.ai.set_conversation_id("my-conversation-123")`,
        },
      ]
    : [
        {
          type: 'text',
          text: t(
            'Group related LLM calls into a single conversation thread by setting an ID at the start:'
          ),
        },
        {
          type: 'code',
          language: 'javascript',
          code: `import * as Sentry from "@sentry/node";

// Call this at the start of each conversation
Sentry.setConversationId("my-conversation-123");`,
        },
      ];

  return {
    title: t('Set Conversation ID'),
    content,
  };
}

export function ConversationOnboarding() {
  const api = useApi();
  const {isSelfHosted, urlPrefix} = useLegacyStore(ConfigStore);
  const project = useOnboardingProject();
  const organization = useOrganization();
  const copyEnabled = useCopySetupInstructionsEnabled();
  const location = useLocation();
  const navigate = useNavigate();

  const currentPlatform = project?.platform
    ? platforms.find(p => p.id === project.platform)
    : undefined;

  const {isLoading, docs, dsn, projectKeyId} = useLoadGettingStarted({
    platform: currentPlatform || otherPlatform,
    orgSlug: organization.slug,
    projSlug: project?.slug,
  });

  const isPythonPlatform = (project?.platform ?? '').startsWith('python');
  const isNodePlatform = (project?.platform ?? '').startsWith('node');
  const isFullStackJsPlatform = javascriptMetaFrameworks.includes(
    project?.platform ?? 'other'
  );
  const hasServerSideNode = isNodePlatform || isFullStackJsPlatform;

  const integrationOptions = {
    integration: {
      label: t('Integration'),
      items: isPythonPlatform
        ? PYTHON_AGENT_INTEGRATIONS.map(integration => ({
            label: AGENT_INTEGRATION_LABELS[integration],
            value: integration,
            leadingItems: (
              <PlatformIcon platform={AGENT_INTEGRATION_ICONS[integration]} size={16} />
            ),
          }))
        : (hasServerSideNode
            ? NODE_AGENT_INTEGRATIONS
            : NODE_AGENT_INTEGRATIONS.filter(
                integration => !serverSideNodeIntegrations.has(integration)
              )
          ).map(integration => ({
            label: AGENT_INTEGRATION_LABELS[integration],
            value: integration,
            leadingItems: (
              <PlatformIcon platform={AGENT_INTEGRATION_ICONS[integration]} size={16} />
            ),
          })),
    },
  };

  const selectedPlatformOptions = useUrlPlatformOptions(integrationOptions);

  const {isPending: isLoadingRegistry, data: registryData} =
    useSourcePackageRegistries(organization);

  if (!project) {
    return <div>{t('No project found')}</div>;
  }

  if (!agentMonitoringPlatforms.has(project.platform as PlatformKey)) {
    return (
      <UnsupportedPlatformOnboarding
        project={project}
        platformName={currentPlatform?.name || project.slug}
      />
    );
  }

  if (isLoading) {
    return <LoadingIndicator />;
  }

  const agentMonitoringDocs = docs?.agentMonitoringOnboarding;

  if (!agentMonitoringDocs || !dsn || !projectKeyId) {
    return <NoDocsOnboarding project={project} />;
  }

  const docParams: DocsParams<any> = {
    api,
    projectKeyId,
    dsn,
    organization,
    platformKey: project.platform || 'other',
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
    platformOptions: selectedPlatformOptions,
    docsLocation: DocsPageLocation.PROFILING_PAGE,
    newOrg: false,
    urlPrefix,
    isSelfHosted,
  };

  const selectedIntegration = selectedPlatformOptions.integration;
  const showConversationIdStep = needsManualConversationId(
    selectedIntegration,
    isPythonPlatform
  );

  const steps: OnboardingStep[] = [
    ...(agentMonitoringDocs.install?.(docParams) || []),
    ...(agentMonitoringDocs.configure?.(docParams) || []),
    ...(showConversationIdStep
      ? [getConversationIdStep(selectedIntegration, isPythonPlatform)]
      : []),
    ...(agentMonitoringDocs.verify?.(docParams) || []),
  ].filter(s => !s.collapsible);

  const introduction = agentMonitoringDocs.introduction?.(docParams);

  return (
    <ConversationOnboardingPanel project={project}>
      <SetupTitle project={project} />
      <OptionsWrapper>
        <PlatformOptionDropdown platformOptions={integrationOptions} />
      </OptionsWrapper>
      {introduction && <DescriptionWrapper>{introduction}</DescriptionWrapper>}
      <GuidedSteps
        key={`${selectedIntegration}-${showConversationIdStep}`}
        initialStep={decodeInteger(location.query.guidedStep)}
        onStepChange={step => {
          navigate({
            pathname: location.pathname,
            query: {
              ...location.query,
              guidedStep: step,
            },
          });
        }}
      >
        {steps.map((step, index) => (
          <ConversationStepRenderer
            key={step.title || step.type}
            project={project}
            step={step}
            stepIndex={index}
            isLastStep={index === steps.length - 1}
            trailingItems={
              index === 0 && copyEnabled ? (
                <OnboardingCopyMarkdownButton
                  borderless
                  steps={steps}
                  source="conversations_onboarding"
                />
              ) : undefined
            }
          />
        ))}
      </GuidedSteps>
    </ConversationOnboardingPanel>
  );
}

function UnsupportedPlatformOnboarding({
  project,
  platformName,
}: {
  platformName: string;
  project: Project;
}) {
  return (
    <ConversationOnboardingPanel project={project}>
      <DescriptionWrapper>
        <p>
          {tct(
            "Auto instrumentation isn't available for [platform] yet, but you can still get conversations working.",
            {
              platform: platformName,
            }
          )}
        </p>
        <p>
          {tct(
            '[link:Manually instrument] your agents using the Sentry SDK, or let an AI coding agent set it up for you.',
            {
              link: (
                <ExternalLink href="https://docs.sentry.io/platforms/python/tracing/instrumentation/custom-instrumentation/ai-agents-module/" />
              ),
            }
          )}
        </p>
        <CopyLLMPromptButton />
      </DescriptionWrapper>
    </ConversationOnboardingPanel>
  );
}

function NoDocsOnboarding({project}: {project: Project}) {
  return (
    <ConversationOnboardingPanel project={project}>
      <DescriptionWrapper>
        <p>
          {tct(
            "We don't have a setup checklist for [project] yet, but that won't stop us.",
            {project: project.slug}
          )}
        </p>
        <p>
          {tct(
            'Follow our [link:documentation] to get started, or let an AI coding agent handle the setup for you.',
            {
              link: (
                <ExternalLink href="https://docs.sentry.io/product/insights/ai/agents/getting-started/" />
              ),
            }
          )}
        </p>
        <CopyLLMPromptButton />
      </DescriptionWrapper>
    </ConversationOnboardingPanel>
  );
}

const EventWaitingIndicator = styled((p: React.HTMLAttributes<HTMLDivElement>) => (
  <div {...p}>
    {t('Listening for your first conversation...')}
    <PulsingIndicator />
  </div>
))`
  display: flex;
  align-items: center;
  position: relative;
  padding: 0 ${p => p.theme.space.md};
  z-index: 10;
  gap: ${p => p.theme.space.md};
  flex-grow: 1;
  font-size: ${p => p.theme.font.size.md};
  color: ${p => p.theme.colors.pink500};
  padding-right: ${p => p.theme.space['3xl']};
`;

const PulseSpacer = styled('div')`
  height: ${p => p.theme.space['3xl']};
`;

const PulsingIndicator = styled('div')`
  ${pulsingIndicatorStyles};
  flex-shrink: 0;
`;

const Title = styled('div')`
  font-size: 26px;
  font-weight: ${p => p.theme.font.weight.sans.medium};
  margin-bottom: ${p => p.theme.space.md};
`;

const SubTitle = styled('div')`
  margin-bottom: ${p => p.theme.space.md};
`;

const BulletList = styled('ul')`
  list-style-type: disc;
  padding-left: 20px;
  margin-bottom: ${p => p.theme.space.xl};

  li {
    margin-bottom: ${p => p.theme.space.md};
  }
`;

const Header = styled('div')`
  display: flex;
  justify-content: space-between;
  gap: ${p => p.theme.space['2xl']};
  padding: ${p => p.theme.space['3xl']};
`;

const HeaderText = styled('div')`
  flex: 0.65;

  @media (max-width: ${p => p.theme.breakpoints.sm}) {
    flex: 1;
  }
`;

const HeaderImage = styled('img')`
  display: block;
  pointer-events: none;
  height: 120px;
  overflow: hidden;

  @media (max-width: ${p => p.theme.breakpoints.sm}) {
    display: none;
  }
`;

const Divider = styled('hr')`
  width: 95%;
  border: none;
  border-top: 1px solid ${p => p.theme.tokens.border.primary};
  margin: 0;
`;

const SetupContent = styled('div')`
  padding: ${p => p.theme.space['3xl']};
`;

const DescriptionWrapper = styled('div')`
  code:not([class*='language-']) {
    color: ${p => p.theme.colors.pink500};
  }

  :not(:last-child) {
    margin-bottom: ${space(1)};
  }

  && > h4,
  && > h5,
  && > h6 {
    font-size: ${p => p.theme.font.size.xl};
    font-weight: ${p => p.theme.font.weight.sans.medium};
    line-height: 34px;
  }

  && > * {
    margin: 0;
    &:not(:last-child) {
      margin-bottom: ${space(1)};
    }
  }
`;

const OptionsWrapper = styled('div')`
  display: flex;
  gap: ${p => p.theme.space.md};
  align-items: center;
  flex-wrap: wrap;
  padding-bottom: ${p => p.theme.space.md};
`;
