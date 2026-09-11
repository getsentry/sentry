import {useEffect, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {PlatformIcon} from 'platformicons';

import replayOnboardingImg from 'sentry-images/spot/replay-inline-onboarding-v2.svg';

import {Button} from '@sentry/scraps/button';
import {Image} from '@sentry/scraps/image';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Separator} from '@sentry/scraps/separator';
import {TabList, TabPanels, Tabs} from '@sentry/scraps/tabs';
import {Heading, Prose, Text} from '@sentry/scraps/text';

import {ClippedBox} from 'sentry/components/clippedBox';
import {GuidedSteps} from 'sentry/components/guidedSteps/guidedSteps';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {AuthTokenGeneratorProvider} from 'sentry/components/onboarding/gettingStartedDoc/authTokenGenerator';
import {ContentBlocksRenderer} from 'sentry/components/onboarding/gettingStartedDoc/contentBlocks/renderer';
import type {ContentBlock} from 'sentry/components/onboarding/gettingStartedDoc/contentBlocks/types';
import {OnboardingCopyMarkdownButton} from 'sentry/components/onboarding/gettingStartedDoc/onboardingCopyMarkdownButton';
import {
  StepIndexProvider,
  TabSelectionScope,
} from 'sentry/components/onboarding/gettingStartedDoc/selectedCodeTabContext';
import {StepTitles} from 'sentry/components/onboarding/gettingStartedDoc/step';
import type {
  BasePlatformOptions,
  DocsParams,
  OnboardingStep,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  DocsPageLocation,
  StepType,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {useSourcePackageRegistries} from 'sentry/components/onboarding/gettingStartedDoc/useSourcePackageRegistries';
import {useLoadGettingStarted} from 'sentry/components/onboarding/gettingStartedDoc/utils/useLoadGettingStarted';
import {PlatformOptionDropdown} from 'sentry/components/onboarding/platformOptionDropdown';
import {useUrlPlatformOptions} from 'sentry/components/onboarding/platformOptionsControl';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {Panel} from 'sentry/components/panels/panel';
import {PanelBody} from 'sentry/components/panels/panelBody';
import {SetupTitle} from 'sentry/components/updatedEmptyState';
import {agentMonitoringPlatforms} from 'sentry/data/platformCategories';
import {otherPlatform, allPlatforms as platforms} from 'sentry/data/platforms';
import {IconBot, IconCopy, IconUser} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {ConfigStore} from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {decodeInteger} from 'sentry/utils/queryString';
import {useApi} from 'sentry/utils/useApi';
import {useCopyToClipboard} from 'sentry/utils/useCopyToClipboard';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {Referrer} from 'sentry/views/explore/conversations/utils/referrers';
import {useSpans} from 'sentry/views/insights/common/queries/useDiscover';
import {
  CopyLLMPromptButton,
  getAgentSetupPrompt,
} from 'sentry/views/insights/pages/agents/llmOnboardingInstructions';
import {
  AGENT_INTEGRATION_ICONS,
  AGENT_INTEGRATION_LABELS,
  AgentIntegration,
  DEPLOYMENT_TARGET_ICONS,
  DEPLOYMENT_TARGET_LABELS,
  DeploymentTarget,
  getIntegrationDeploymentTarget,
  NODE_AGENT_INTEGRATIONS,
  PHP_AGENT_INTEGRATIONS,
  PYTHON_AGENT_INTEGRATIONS,
} from 'sentry/views/insights/pages/agents/utils/agentIntegrations';
import {AI_INSTRUMENTATION_DOCS_LINKS} from 'sentry/views/insights/pages/agents/utils/docsLinks';
import {
  BulletList,
  HeaderText,
  PulseSpacer,
  PulsingIndicator,
  SubTitle,
  useOnboardingProject,
} from 'sentry/views/insights/pages/onboardingUtils';

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
    Referrer.ONBOARDING
  );

  const hasEvents = Boolean(request.data?.length);

  useEffect(() => {
    if (hasEvents && shouldRefetch) {
      // oxlint-disable-next-line react/set-state-in-effect
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
    <Button variant="primary" onClick={onDismiss}>
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
  onDismiss,
}: {
  isLastStep: boolean;
  onDismiss: () => void;
  project: Project;
  step: OnboardingStep;
  stepIndex: number;
}) {
  const theme = useTheme();
  return (
    <GuidedSteps.Step
      stepKey={step.type || step.title}
      title={step.title || (step.type && StepTitles[step.type])}
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

function AgentSetupInstructions({
  project,
  prompt,
  onDismiss,
}: {
  onDismiss: () => void;
  project: Project;
  prompt: string;
}) {
  const {copy} = useCopyToClipboard();

  return (
    <Stack gap="xl" align="start" paddingTop="md">
      <Text>
        {t(
          'Give this prompt to your coding agent to set up agent tracing for this project.'
        )}
      </Text>
      <Container width="100%" border="primary" radius="md" padding="lg">
        {containerProps => (
          <ClippedBox
            {...containerProps}
            clipHeight={150}
            defaultClipped
            collapsible
            buttonProps={{variant: 'secondary', size: 'xs'}}
          >
            <Text
              as="div"
              size="sm"
              monospace
              wrap="pre-wrap"
              wordBreak="break-word"
              density="comfortable"
            >
              {prompt}
            </Text>
          </ClippedBox>
        )}
      </Container>
      <Button
        size="md"
        variant="primary"
        icon={<IconCopy />}
        analyticsEventKey="onboarding.ai_prompt_copied"
        analyticsEventName="Onboarding: AI Prompt Copied"
        analyticsParams={{
          platform: project.platform ?? 'unknown',
          product: 'conversations',
          source: 'prompt',
        }}
        onClick={() => {
          copy(prompt, {
            successMessage: t('Copied setup prompt to clipboard'),
          });
        }}
      >
        {t('Copy prompt')}
      </Button>
      <ConversationWaitingIndicator project={project} onDismiss={onDismiss} />
      <PulseSpacer />
    </Stack>
  );
}

function ConversationOnboardingPanel({
  project,
  children,
  dsn,
  onDismiss,
  hasPlatformInstructions = true,
}: {
  children: React.ReactNode;
  onDismiss: () => void;
  project: Project;
  dsn?: string;
  hasPlatformInstructions?: boolean;
}) {
  const organization = useOrganization();
  const prompt = dsn
    ? getAgentSetupPrompt({organizationSlug: organization.slug, project, dsn})
    : undefined;
  const defaultTab = prompt ? 'agent' : 'human';
  const isHumanTabDisabled = Boolean(prompt) && !hasPlatformInstructions;

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
                <Container display={{zero: 'none', xl: 'block'}}>
                  <Image src={replayOnboardingImg} alt="" height="120px" width="auto" />
                </Container>
              </Flex>
              <Container width="95%" margin="0 auto">
                <Separator orientation="horizontal" />
              </Container>
              <Grid autoColumns="minmax(0, 1fr)" flow="column" position="relative">
                <Setup>
                  <SetupTitle project={project} />
                  <Tabs
                    key={defaultTab}
                    defaultValue={defaultTab}
                    aria-label={t('Setup instructions')}
                  >
                    <TabList variant="floating">
                      <TabList.Item
                        key="agent"
                        textValue={t('For your agent')}
                        disabled={!prompt}
                        tooltip={
                          prompt
                            ? undefined
                            : {
                                title: t(
                                  'A project DSN is required to copy a setup prompt.'
                                ),
                              }
                        }
                      >
                        <IconBot />
                        {t('For your agent')}
                      </TabList.Item>
                      <TabList.Item
                        key="human"
                        textValue={t('For you')}
                        disabled={isHumanTabDisabled}
                        tooltip={
                          isHumanTabDisabled
                            ? {
                                title: t(
                                  "Step-by-step instructions aren't available for this platform."
                                ),
                              }
                            : undefined
                        }
                      >
                        <IconUser />
                        {t('For you')}
                      </TabList.Item>
                    </TabList>
                    <TabPanels>
                      <TabPanels.Item key="agent">
                        {prompt && (
                          <AgentSetupInstructions
                            project={project}
                            prompt={prompt}
                            onDismiss={onDismiss}
                          />
                        )}
                      </TabPanels.Item>
                      <TabPanels.Item key="human">
                        <Container paddingTop="md">{children}</Container>
                      </TabPanels.Item>
                    </TabPanels>
                  </Tabs>
                </Setup>
                <Container padding="xl" paddingTop="3xl">
                  <Heading as="h4" size="xl">
                    {t('Preview Conversations')}
                  </Heading>
                  <Arcade
                    src="https://demo.arcade.software/aEDAYP7ebTJvWKABSBdc?embed"
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

function getConversationIdStep(
  integration: string,
  platform: 'javascript' | 'php' | 'python',
  jsPackageName = '@sentry/node'
): OnboardingStep {
  const isOpenAI =
    integration === AgentIntegration.OPENAI ||
    integration === AgentIntegration.OPENAI_AGENTS;

  if (platform === 'php') {
    return {
      title: t('Enable Conversations'),
      content: [
        {
          type: 'text',
          text: tct(
            'Make your Laravel AI agent conversational with the [code:Conversational] contract and [code:RemembersConversations] trait:',
            {code: <code />}
          ),
        },
        {
          type: 'code',
          language: 'php',
          code: `<?php
// ...

use Laravel\\Ai\\Concerns\\RemembersConversations;
use Laravel\\Ai\\Contracts\\Agent;
use Laravel\\Ai\\Contracts\\Conversational;
use Laravel\\Ai\\Promptable;

class MyAgent implements Agent, Conversational
{
    use Promptable, RemembersConversations;

    // ...
}`,
        },
      ],
    };
  }

  const conversationIdCodeBlock: ContentBlock =
    platform === 'python'
      ? {
          type: 'code',
          language: 'python',
          code: `import sentry_sdk.ai

# Call this at the start of each conversation
sentry_sdk.ai.set_conversation_id("my-conversation-123")`,
        }
      : {
          type: 'code',
          language: 'javascript',
          code: `import * as Sentry from "${jsPackageName}";

// Call this at the start of each conversation
Sentry.setConversationId("my-conversation-123");`,
        };

  const content: ContentBlock[] = [
    {
      type: 'text',
      text: t(
        'Group related LLM calls into a single conversation thread by setting an ID at the start:'
      ),
    },
    conversationIdCodeBlock,
    ...(isOpenAI
      ? [
          {
            type: 'alert' as const,
            alertType: 'info' as const,
            text: t(
              "Alternatively, you can pass the conversation property to OpenAI's API and Sentry will automatically track the conversation ID."
            ),
          },
        ]
      : []),
  ];

  return {
    title: t('Set Conversation ID'),
    content,
  };
}

function getSetUserStep(
  isPython: boolean,
  jsPackageName = '@sentry/node'
): OnboardingStep {
  const content: ContentBlock[] = [
    {
      type: 'text',
      text: t(
        'Identify the user behind each conversation so the Conversations view can show who sent each message:'
      ),
    },
    isPython
      ? {
          type: 'code' as const,
          language: 'python',
          code: `import sentry_sdk

# Call this once per request / session, before any AI calls
sentry_sdk.set_user({"id": "user_123", "email": "jane@example.com", "username": "jane"})`,
        }
      : {
          type: 'code' as const,
          language: 'javascript',
          code: `import * as Sentry from "${jsPackageName}";

// Call this once per request / session, before any AI calls
Sentry.setUser({ id: "user_123", email: "jane@example.com", username: "jane" });`,
        },
  ];

  return {
    title: t('Identify Users (optional)'),
    content,
  };
}

function getPhpConversationVerifyStep(): OnboardingStep {
  return {
    type: StepType.VERIFY,
    content: [
      {
        type: 'text',
        text: tct(
          'Verify Conversations by continuing an existing Laravel AI conversation with [code:->continue()]:',
          {code: <code />}
        ),
      },
      {
        type: 'code',
        language: 'php',
        code: `<?php

use App\\Ai\\Agents\\MyAgent;

$response = (new MyAgent)
    ->continue('my-conversation-123', as: auth()->user())
    ->prompt('Make it shorter.');`,
      },
    ],
  };
}

export function ConversationOnboarding({onDismiss}: {onDismiss: () => void}) {
  const api = useApi();
  const {isSelfHosted, urlPrefix} = useLegacyStore(ConfigStore);
  const project = useOnboardingProject();
  const organization = useOrganization();
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
  const isPhpPlatform = (project?.platform ?? '').startsWith('php');
  // Node-based platforms can deploy to either the Node runtime or Cloudflare
  // Workers, so we let the user pick a target that tailors the instructions.
  const isNodePlatform = (project?.platform ?? '').startsWith('node');
  // Cloudflare Workers projects are pinned to the Cloudflare (withSentry) setup.
  // Cloudflare Pages bootstraps via `sentryPagesPlugin` instead, so it's left out
  // of this selector for now and keeps its existing onboarding.
  const isCloudflareWorkers = project?.platform === 'node-cloudflare-workers';
  const isCloudflarePages = project?.platform === 'node-cloudflare-pages';
  const showDeploymentTarget =
    isNodePlatform && !isCloudflareWorkers && !isCloudflarePages;

  const deploymentTargetOptions: BasePlatformOptions = showDeploymentTarget
    ? {
        deploymentTarget: {
          label: t('Deployment'),
          defaultValue: DeploymentTarget.NODE,
          items: [DeploymentTarget.NODE, DeploymentTarget.CLOUDFLARE].map(target => ({
            label: DEPLOYMENT_TARGET_LABELS[target],
            value: target,
            leadingItems: (
              <PlatformIcon platform={DEPLOYMENT_TARGET_ICONS[target]} size={16} alt="" />
            ),
          })),
        },
      }
    : {};

  // The SDK list is no longer filtered by runtime: Node projects see every
  // Node/Cloudflare agent SDK, and the chosen SDK drives the runtime below.
  const integrations = isPythonPlatform
    ? PYTHON_AGENT_INTEGRATIONS
    : isPhpPlatform
      ? PHP_AGENT_INTEGRATIONS
      : NODE_AGENT_INTEGRATIONS;

  const platformOptions: BasePlatformOptions = {
    integration: {
      label: t('Integration'),
      items: integrations.map(integration => ({
        label: isPhpPlatform
          ? (currentPlatform?.name ?? t('Laravel'))
          : AGENT_INTEGRATION_LABELS[integration],
        value: integration,
        leadingItems: (
          <PlatformIcon
            platform={
              isPhpPlatform
                ? (project?.platform ?? 'php-laravel')
                : AGENT_INTEGRATION_ICONS[integration]
            }
            size={16}
            alt=""
          />
        ),
      })),
    },
    ...deploymentTargetOptions,
  };

  const selectedPlatformOptions = useUrlPlatformOptions(platformOptions);

  // A runtime-specific SDK (e.g. Workers AI -> Cloudflare, Mastra -> Node) pins
  // the runtime and locks the selector; otherwise the user's dropdown choice
  // wins (the selector defaults to Node). Cloudflare Workers projects stay
  // pinned to Cloudflare regardless of the SDK.
  const integrationDeploymentTarget = getIntegrationDeploymentTarget(
    selectedPlatformOptions.integration
  );
  const selectedDeploymentTarget = selectedPlatformOptions.deploymentTarget as
    | DeploymentTarget
    | undefined;
  const deploymentTarget = isCloudflareWorkers
    ? DeploymentTarget.CLOUDFLARE
    : (integrationDeploymentTarget ?? selectedDeploymentTarget);
  const isCloudflareTarget =
    isNodePlatform && deploymentTarget === DeploymentTarget.CLOUDFLARE;

  const {isPending: isLoadingRegistry, data: registryData} =
    useSourcePackageRegistries(organization);

  if (!project) {
    return <div>{t('No project found')}</div>;
  }

  if (isLoading) {
    return <LoadingIndicator />;
  }

  if (!agentMonitoringPlatforms.has(project.platform!)) {
    return (
      <UnsupportedPlatformOnboarding
        project={project}
        platformName={currentPlatform?.name || project.slug}
        dsn={dsn?.public}
        onDismiss={onDismiss}
      />
    );
  }

  const agentMonitoringDocs = docs?.agentMonitoringOnboarding;

  if (!agentMonitoringDocs || !dsn || !projectKeyId) {
    return <NoDocsOnboarding project={project} dsn={dsn?.public} onDismiss={onDismiss} />;
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
    platformOptions: {...selectedPlatformOptions, deploymentTarget},
    docsLocation: DocsPageLocation.PROFILING_PAGE,
    urlPrefix,
    isSelfHosted,
  };

  const selectedIntegration =
    selectedPlatformOptions.integration ?? AgentIntegration.VERCEL_AI;
  const jsPackageName = isCloudflareTarget ? '@sentry/cloudflare' : '@sentry/node';

  // Eve only drains OpenTelemetry traces to Sentry - it doesn't run the Sentry
  // SDK, so there's no `Sentry.setConversationId` / `Sentry.setUser` to call.
  const isEve = selectedIntegration === AgentIntegration.EVE;
  // Flue sets the conversation ID automatically, so the manual
  // `Sentry.setConversationId` step is redundant. It still runs the Sentry SDK,
  // so the `Sentry.setUser` step below stays.
  const isFlue = selectedIntegration === AgentIntegration.FLUE;

  const steps: OnboardingStep[] = [
    ...(agentMonitoringDocs.install?.(docParams) || []),
    ...(agentMonitoringDocs.configure?.(docParams) || []),
    ...(isEve || isFlue
      ? []
      : [
          getConversationIdStep(
            selectedIntegration,
            isPythonPlatform ? 'python' : isPhpPlatform ? 'php' : 'javascript',
            jsPackageName
          ),
        ]),
    ...(isPhpPlatform || isEve ? [] : [getSetUserStep(isPythonPlatform, jsPackageName)]),
    ...(isPhpPlatform
      ? [getPhpConversationVerifyStep()]
      : agentMonitoringDocs.verify?.(docParams) || []),
  ].filter(s => !s.collapsible);

  const introduction = agentMonitoringDocs.introduction?.(docParams);

  return (
    <ConversationOnboardingPanel project={project} dsn={dsn.public} onDismiss={onDismiss}>
      <Stack gap="xl">
        <Flex gap="lg" align="center" justify="between" wrap="wrap">
          <Flex gap="sm" align="center" wrap="wrap">
            <Text>{t('Set up')}</Text>
            <PlatformOptionDropdown
              platformOptions={platformOptions}
              connectors={{deploymentTarget: t('on')}}
              lockedValues={
                integrationDeploymentTarget
                  ? {deploymentTarget: integrationDeploymentTarget}
                  : undefined
              }
            />
          </Flex>
          <OnboardingCopyMarkdownButton
            borderless
            steps={steps}
            source="conversations_onboarding"
            onCopy={() => {
              trackAnalytics('onboarding.ai_prompt_copied', {
                organization,
                platform: project.platform ?? 'unknown',
                product: 'conversations',
                source: 'prompt',
              });
            }}
          />
        </Flex>
        <Separator orientation="horizontal" />
        {introduction && <Prose>{introduction}</Prose>}
        <GuidedSteps
          key={selectedIntegration}
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
            />
          ))}
        </GuidedSteps>
      </Stack>
    </ConversationOnboardingPanel>
  );
}

function UnsupportedPlatformOnboarding({
  project,
  platformName,
  dsn,
  onDismiss,
}: {
  onDismiss: () => void;
  platformName: string;
  project: Project;
  dsn?: string;
}) {
  return (
    <ConversationOnboardingPanel
      project={project}
      dsn={dsn}
      onDismiss={onDismiss}
      hasPlatformInstructions={false}
    >
      <Prose>
        <Text as="p">
          {tct(
            "Auto instrumentation isn't available for [platform] yet, but you can still get conversations working.",
            {
              platform: platformName,
            }
          )}
        </Text>
        <Text as="p">
          {tct(
            '[link:Manually instrument] your agents using the Sentry SDK, or let an AI coding agent set it up for you.',
            {
              link: <ExternalLink href={AI_INSTRUMENTATION_DOCS_LINKS.python} />,
            }
          )}
        </Text>
        <CopyLLMPromptButton
          platform={project.platform ?? 'unknown'}
          product="conversations"
        />
      </Prose>
    </ConversationOnboardingPanel>
  );
}

function NoDocsOnboarding({
  project,
  dsn,
  onDismiss,
}: {
  onDismiss: () => void;
  project: Project;
  dsn?: string;
}) {
  return (
    <ConversationOnboardingPanel
      project={project}
      dsn={dsn}
      onDismiss={onDismiss}
      hasPlatformInstructions={false}
    >
      <Prose>
        <Text as="p">
          {tct(
            "We don't have a setup checklist for [project] yet, but that won't stop us.",
            {project: project.slug}
          )}
        </Text>
        <Text as="p">
          {tct(
            'Follow our [link:documentation] to get started, or let an AI coding agent handle the setup for you.',
            {
              link: (
                <ExternalLink href="https://docs.sentry.io/product/insights/ai/agents/getting-started/" />
              ),
            }
          )}
        </Text>
        <CopyLLMPromptButton
          platform={project.platform ?? 'unknown'}
          product="conversations"
        />
      </Prose>
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
