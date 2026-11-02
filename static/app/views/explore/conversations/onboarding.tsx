import styled from '@emotion/styled';

import agentTracingEmptyStateImg from 'sentry-images/spot/agent-tracing-empty-state.svg';

import {Button} from '@sentry/scraps/button';
import {Image} from '@sentry/scraps/image';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Separator} from '@sentry/scraps/separator';
import {Heading, Prose, Text} from '@sentry/scraps/text';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {AuthTokenGeneratorProvider} from 'sentry/components/onboarding/gettingStartedDoc/authTokenGenerator';
import type {ContentBlock} from 'sentry/components/onboarding/gettingStartedDoc/contentBlocks/types';
import {OnboardingCopyMarkdownButton} from 'sentry/components/onboarding/gettingStartedDoc/onboardingCopyMarkdownButton';
import {TabSelectionScope} from 'sentry/components/onboarding/gettingStartedDoc/selectedCodeTabContext';
import type {OnboardingStep} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {Panel} from 'sentry/components/panels/panel';
import {PanelBody} from 'sentry/components/panels/panelBody';
import {SetupTitle} from 'sentry/components/updatedEmptyState';
import {t, tct} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useOrganization} from 'sentry/utils/useOrganization';
import {Referrer} from 'sentry/views/explore/conversations/utils/referrers';
import {
  AgentSetupOptions,
  AgentSetupSteps,
} from 'sentry/views/insights/pages/agents/components/agentSetupSteps';
import {AgentSetupTabs} from 'sentry/views/insights/pages/agents/components/agentSetupTabs';
import {CopyLLMPromptButton} from 'sentry/views/insights/pages/agents/llmOnboardingInstructions';
import {AgentIntegration} from 'sentry/views/insights/pages/agents/utils/agentIntegrations';
import {
  AI_AGENTS_GETTING_STARTED_DOCS_LINK,
  AI_INSTRUMENTATION_DOCS_LINKS,
} from 'sentry/views/insights/pages/agents/utils/docsLinks';
import {useAgentOnboardingSetup} from 'sentry/views/insights/pages/agents/utils/useAgentOnboardingSetup';
import {
  BulletList,
  HeaderText,
  PulsingIndicator,
  SubTitle,
  useSpanWaiter,
} from 'sentry/views/insights/pages/onboardingUtils';

function ConversationWaitingIndicator({
  project,
  onDismiss,
}: {
  onDismiss: () => void;
  project: Project;
}) {
  const spanRequest = useSpanWaiter({
    project,
    search: 'has:gen_ai.conversation.id',
    referrer: Referrer.ONBOARDING,
  });
  const hasEvents = Boolean(spanRequest.data?.length);

  return hasEvents ? (
    <Button
      variant="primary"
      analyticsEventKey="conversations.onboarding.interaction"
      analyticsEventName="Conversations: Onboarding Interaction"
      analyticsParams={{action: 'view_conversations'}}
      onClick={onDismiss}
    >
      {t('View Conversations')}
    </Button>
  ) : (
    <EventWaitingIndicator />
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

  return (
    <Panel>
      <PanelBody>
        <AuthTokenGeneratorProvider projectSlug={project?.slug}>
          <TabSelectionScope>
            <div>
              <Flex containerType="inline-size" justify="between" gap="2xl" padding="3xl">
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
                <Container
                  display={{zero: 'none', xl: 'block'}}
                  alignSelf="center"
                  pointerEvents="none"
                  flexShrink={0}
                >
                  <Image
                    src={agentTracingEmptyStateImg}
                    alt=""
                    height="180px"
                    width="auto"
                  />
                </Container>
              </Flex>
              <Container width="95%" margin="0 auto">
                <Separator orientation="horizontal" />
              </Container>
              <Grid autoColumns="minmax(0, 1fr)" flow="column" position="relative">
                <Setup>
                  <SetupTitle project={project} />
                  <AgentSetupTabs
                    project={project}
                    dsn={dsn}
                    hasPlatformInstructions={hasPlatformInstructions}
                    waitingIndicator={
                      <ConversationWaitingIndicator
                        project={project}
                        onDismiss={onDismiss}
                      />
                    }
                    onInteraction={interaction => {
                      trackAnalytics('conversations.onboarding.interaction', {
                        organization,
                        ...interaction,
                      });
                    }}
                  >
                    {children}
                  </AgentSetupTabs>
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

const INTEGRATIONS_WITH_AUTOMATIC_CONVERSATION_IDS = new Set<string>([
  AgentIntegration.EVE,
  AgentIntegration.FLUE,
  AgentIntegration.MASTRA,
  AgentIntegration.PI,
]);

export function ConversationOnboarding({onDismiss}: {onDismiss: () => void}) {
  const organization = useOrganization();
  const setup = useAgentOnboardingSetup();

  switch (setup.status) {
    case 'no-project':
      return <div>{t('No project found')}</div>;
    case 'loading':
      return <LoadingIndicator />;
    case 'unsupported':
      return (
        <UnsupportedPlatformOnboarding
          project={setup.project}
          platformName={setup.platformName}
          dsn={setup.dsn?.public}
          onDismiss={onDismiss}
        />
      );
    case 'no-docs':
      return (
        <NoDocsOnboarding
          project={setup.project}
          dsn={setup.dsn?.public}
          onDismiss={onDismiss}
        />
      );
    default:
      break;
  }

  const {project, dsn, introduction, isPhpPlatform, isPythonPlatform} = setup;

  const selectedIntegration =
    setup.selectedPlatformOptions.integration ?? AgentIntegration.VERCEL_AI;
  const jsPackageName = setup.sdkImportSpecifier ?? '@sentry/node';

  const setsConversationIdAutomatically =
    INTEGRATIONS_WITH_AUTOMATIC_CONVERSATION_IDS.has(selectedIntegration);

  const steps: OnboardingStep[] = [
    ...setup.installSteps,
    ...setup.configureSteps,
    ...(setsConversationIdAutomatically
      ? []
      : [
          getConversationIdStep(
            selectedIntegration,
            isPythonPlatform ? 'python' : isPhpPlatform ? 'php' : 'javascript',
            jsPackageName
          ),
        ]),
    ...(isPhpPlatform ? [] : [getSetUserStep(isPythonPlatform, jsPackageName)]),
    ...(isPhpPlatform ? [getPhpConversationVerifyStep()] : setup.verifySteps),
  ].filter(s => !s.collapsible);

  return (
    <ConversationOnboardingPanel project={project} dsn={dsn.public} onDismiss={onDismiss}>
      <Stack gap="xl">
        {setup.showPlatformOptions && (
          <Flex gap="lg" align="center" justify="between" wrap="wrap">
            <Flex gap="sm" align="center" wrap="wrap">
              <Text>{t('Set up')}</Text>
              <AgentSetupOptions
                setup={setup}
                onChange={(option, value) => {
                  trackAnalytics('conversations.onboarding.interaction', {
                    organization,
                    action: 'select_setup_option',
                    option,
                    value,
                  });
                }}
              />
            </Flex>
          </Flex>
        )}
        {setup.showPlatformOptions && <Separator orientation="horizontal" />}
        {introduction && <Prose>{introduction}</Prose>}
        <AgentSetupSteps
          setup={setup}
          steps={steps}
          analyticsEventKey="conversations.onboarding.interaction"
          lastStepItems={
            <ConversationWaitingIndicator project={project} onDismiss={onDismiss} />
          }
          firstStepTrailingItems={
            <OnboardingCopyMarkdownButton
              borderless
              steps={steps}
              source="conversations_onboarding"
            />
          }
        />
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
            "Auto instrumentation isn't available for [platform], but you can still get conversations working.",
            {
              platform: platformName,
            }
          )}
        </Text>
        <Text as="p">
          {tct(
            '[link:Manually instrument] your agents using the Sentry SDK, or let an AI coding agent set it up for you.',
            {
              link: (
                <ExternalLink
                  href={
                    project.platform?.startsWith('javascript')
                      ? `${AI_INSTRUMENTATION_DOCS_LINKS.javascript}manual-instrumentation/`
                      : `${AI_INSTRUMENTATION_DOCS_LINKS.python}manual-instrumentation/`
                  }
                />
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
              link: <ExternalLink href={AI_AGENTS_GETTING_STARTED_DOCS_LINK} />,
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
