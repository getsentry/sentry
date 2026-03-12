import {useEffect, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {PlatformIcon} from 'platformicons';

import replayOnboardingImg from 'sentry-images/spot/replay-inline-onboarding-v2.svg';

import {Button} from '@sentry/scraps/button';
import {Container, Flex, Grid} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Heading} from '@sentry/scraps/text';

import {GuidedSteps} from 'sentry/components/guidedSteps/guidedSteps';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
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
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {Panel} from 'sentry/components/panels/panel';
import {PanelBody} from 'sentry/components/panels/panelBody';
import {SetupTitle} from 'sentry/components/updatedEmptyState';
import {agentMonitoringPlatforms} from 'sentry/data/platformCategories';
import platforms, {otherPlatform} from 'sentry/data/platforms';
import {t, tct} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import type {PlatformKey, Project} from 'sentry/types/project';
import {decodeInteger} from 'sentry/utils/queryString';
import {useApi} from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
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
import {
  BulletList,
  HeaderText,
  PulseSpacer,
  PulsingIndicator,
  SubTitle,
  useOnboardingProject,
} from 'sentry/views/insights/pages/onboardingUtils';

const PYTHON_AUTO_CONVERSATION_ID = new Set<string>([AgentIntegration.OPENAI_AGENTS]);
const NODE_AUTO_CONVERSATION_ID = new Set<string>([AgentIntegration.OPENAI]);

function needsManualConversationId(integration: string, isPython: boolean): boolean {
  const autoSet = isPython ? PYTHON_AUTO_CONVERSATION_ID : NODE_AUTO_CONVERSATION_ID;
  return !autoSet.has(integration);
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

function ConversationWaitingIndicator({
  project,
  onDismiss,
}: {
  onDismiss: () => void;
  project: Project;
}) {
  const spanRequest = useConversationSpanWaiter(project);
  const hasEvents = Boolean(spanRequest.data?.length);

  return hasEvents ? (
    <Button priority="primary" onClick={onDismiss}>
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
  onDismiss,
}: {
  isLastStep: boolean;
  onDismiss: () => void;
  project: Project;
  step: OnboardingStep;
  stepIndex: number;
  trailingItems?: React.ReactNode;
}) {
  const theme = useTheme();
  return (
    <GuidedSteps.Step
      stepKey={step.type || step.title}
      title={step.title || (step.type && StepTitles[step.type])}
      trailingItems={trailingItems}
    >
      <StepIndexProvider index={stepIndex}>
        <ContentBlocksRenderer spacing={theme.space.md} contentBlocks={step.content} />
      </StepIndexProvider>
      <GuidedSteps.ButtonWrapper>
        <GuidedSteps.BackButton size="md" />
        <GuidedSteps.NextButton size="md" />
        {isLastStep && (
          <ConversationWaitingIndicator project={project} onDismiss={onDismiss} />
        )}
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
              <Flex justify="between" gap="2xl" padding="3xl">
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
              </Flex>
              <Divider />
              <Grid autoColumns="minmax(0, 1fr)" flow="column" position="relative">
                <Setup>{children}</Setup>
                <Container padding="xl" paddingTop="3xl">
                  <Heading as="h4" size="xl">
                    {t('Preview Conversations')}
                  </Heading>
                  <Arcade
                    src="https://demo.arcade.software/oV2kLNiavNzbDHX12Bib?embed"
                    loading="lazy"
                    allowFullScreen
                  />
                </Container>
              </Grid>
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

export function ConversationOnboarding({onDismiss}: {onDismiss: () => void}) {
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

  const integrations = isPythonPlatform
    ? PYTHON_AGENT_INTEGRATIONS
    : NODE_AGENT_INTEGRATIONS;

  const integrationOptions = {
    integration: {
      label: t('Integration'),
      items: integrations.map(integration => ({
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
      <Flex gap="md" align="center" wrap="wrap" paddingBottom="md">
        <PlatformOptionDropdown platformOptions={integrationOptions} />
      </Flex>
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
            onDismiss={onDismiss}
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

const Title = styled('div')`
  font-size: 26px;
  font-weight: ${p => p.theme.font.weight.sans.medium};
  margin-bottom: ${p => p.theme.space.md};
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

const Setup = styled('div')`
  padding: ${p => p.theme.space['3xl']};

  &:after {
    content: '';
    position: absolute;
    right: 50%;
    top: 2.5%;
    height: 95%;
    border-right: 1px ${p => p.theme.tokens.border.primary} solid;
  }
`;

const Arcade = styled('iframe')`
  width: 100%;
  min-height: 420px;
  margin-top: ${p => p.theme.space.md};
  border: 0;
`;

const Divider = styled('hr')`
  width: 95%;
  border: none;
  border-top: 1px solid ${p => p.theme.tokens.border.primary};
  margin: 0;
`;

const DescriptionWrapper = styled('div')`
  code:not([class*='language-']) {
    color: ${p => p.theme.colors.pink500};
  }

  :not(:last-child) {
    margin-bottom: ${p => p.theme.space.md};
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
      margin-bottom: ${p => p.theme.space.md};
    }
  }
`;
