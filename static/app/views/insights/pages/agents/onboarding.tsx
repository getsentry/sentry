import styled from '@emotion/styled';

import agentTracingEmptyStateImg from 'sentry-images/spot/agent-tracing-empty-state.svg';

import {Button} from '@sentry/scraps/button';
import {Image} from '@sentry/scraps/image';
import {Container, Flex} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {AuthTokenGeneratorProvider} from 'sentry/components/onboarding/gettingStartedDoc/authTokenGenerator';
import {
  CopyMarkdownButton,
  OnboardingCopyMarkdownButton,
} from 'sentry/components/onboarding/gettingStartedDoc/onboardingCopyMarkdownButton';
import {TabSelectionScope} from 'sentry/components/onboarding/gettingStartedDoc/selectedCodeTabContext';
import {Panel} from 'sentry/components/panels/panel';
import {PanelBody} from 'sentry/components/panels/panelBody';
import {SetupTitle} from 'sentry/components/updatedEmptyState';
import {t, tct} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {
  AgentSetupOptions,
  AgentSetupSteps,
} from 'sentry/views/insights/pages/agents/components/agentSetupSteps';
import {AgentSetupTabs} from 'sentry/views/insights/pages/agents/components/agentSetupTabs';
import {LLM_ONBOARDING_COPY_MARKDOWN} from 'sentry/views/insights/pages/agents/llmOnboardingInstructions';
import {
  AI_AGENTS_GETTING_STARTED_DOCS_LINK,
  AI_INSTRUMENTATION_DOCS_LINKS,
} from 'sentry/views/insights/pages/agents/utils/docsLinks';
import {getHasAiSpansFilter} from 'sentry/views/insights/pages/agents/utils/query';
import {Referrer} from 'sentry/views/insights/pages/agents/utils/referrers';
import {useAgentOnboardingSetup} from 'sentry/views/insights/pages/agents/utils/useAgentOnboardingSetup';
import {
  BulletList,
  HeaderText,
  PulsingIndicator,
  SubTitle,
  useSpanWaiter,
} from 'sentry/views/insights/pages/onboardingUtils';

function WaitingIndicator({project}: {project: Project}) {
  const spanRequest = useSpanWaiter({
    project,
    search: getHasAiSpansFilter(),
    referrer: Referrer.ONBOARDING,
  });
  const {reloadProjects, fetching} = useProjects();
  const hasEvents = Boolean(spanRequest.data?.length);

  return hasEvents ? (
    <Button
      variant="primary"
      busy={fetching}
      analyticsEventKey="agent-monitoring.onboarding.interaction"
      analyticsEventName="Agent Monitoring: Onboarding Interaction"
      analyticsParams={{action: 'view_agent_monitoring'}}
      onClick={reloadProjects}
    >
      {t('View Agent Monitoring')}
    </Button>
  ) : (
    <EventWaitingIndicator />
  );
}

function OnboardingPanel({
  project,
  children,
  dsn,
  hasPlatformInstructions = true,
}: {
  children: React.ReactNode;
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
              <Flex
                containerType="inline-size"
                justify="between"
                gap="2xl"
                radius="md"
                padding="3xl"
              >
                <HeaderText>
                  <Title>{t('Monitor AI Agents')}</Title>
                  <SubTitle>
                    {t(
                      'Get comprehensive visibility into your AI agents and LLM applications to understand performance, costs, and user interactions.'
                    )}
                  </SubTitle>
                  <BulletList>
                    <li>
                      {t(
                        'Track token usage, costs, and latency across all your LLM calls'
                      )}
                    </li>
                    <li>
                      {t(
                        'Monitor agent conversations, tool usage, and decision-making processes'
                      )}
                    </li>
                    <li>
                      {t(
                        'Set a conversation ID for each chat so Sentry can group related spans in Conversations'
                      )}
                    </li>
                    <li>
                      {t(
                        'Debug failed requests and optimize prompt performance with detailed traces'
                      )}
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
              <Divider />
              <Body>
                <Setup>
                  <SetupTitle project={project} />
                  <AgentSetupTabs
                    project={project}
                    dsn={dsn}
                    hasPlatformInstructions={hasPlatformInstructions}
                    waitingIndicator={<WaitingIndicator project={project} />}
                    onInteraction={interaction => {
                      trackAnalytics('agent-monitoring.onboarding.interaction', {
                        organization,
                        ...interaction,
                      });
                    }}
                  >
                    {children}
                  </AgentSetupTabs>
                </Setup>
                <Container padding="3xl">
                  <BodyTitle>{t('Preview Agent Insights')}</BodyTitle>
                  <Arcade
                    src="https://demo.arcade.software/0NzB6M1Wn8sDsFDAj4sE?embed"
                    loading="lazy"
                    allowFullScreen
                  />
                </Container>
              </Body>
            </div>
          </TabSelectionScope>
        </AuthTokenGeneratorProvider>
      </PanelBody>
    </Panel>
  );
}

export function Onboarding() {
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
        />
      );
    case 'no-docs':
      return <NoDocsOnboarding project={setup.project} dsn={setup.dsn?.public} />;
    default:
      break;
  }

  const {project, dsn, introduction, projectAgentIntegration} = setup;

  const steps = [
    ...setup.installSteps,
    ...setup.configureSteps,
    ...setup.verifySteps,
  ].filter(s => !s.collapsible);

  return (
    <OnboardingPanel project={project} dsn={dsn.public}>
      {setup.showPlatformOptions && (
        <OptionsWrapper>
          <AgentSetupOptions
            setup={setup}
            onChange={(option, value) => {
              trackAnalytics('agent-monitoring.onboarding.interaction', {
                organization,
                action: 'select_setup_option',
                option,
                value,
              });
            }}
          />
        </OptionsWrapper>
      )}
      {introduction && <DescriptionWrapper>{introduction}</DescriptionWrapper>}
      {!projectAgentIntegration && (
        <DescriptionWrapper>
          <p>
            {tct(
              'To use [link:Conversations], set a conversation ID for each chat. Sentry uses the [code:gen_ai.conversation.id] attribute to group related AI spans.',
              {
                code: <code />,
                link: (
                  <ExternalLink href="https://docs.sentry.io/product/agents/conversations/" />
                ),
              }
            )}
          </p>
        </DescriptionWrapper>
      )}
      <AgentSetupSteps
        setup={setup}
        steps={steps}
        analyticsEventKey="agent-monitoring.onboarding.interaction"
        lastStepItems={<WaitingIndicator project={project} />}
        firstStepTrailingItems={
          <OnboardingCopyMarkdownButton
            borderless
            steps={steps}
            source="agent_monitoring_onboarding"
            postamble={LLM_ONBOARDING_COPY_MARKDOWN}
            onCopy={() => {
              trackAnalytics('agent-monitoring.copy-llm-prompt-click', {
                organization,
              });
            }}
          />
        }
      />
    </OnboardingPanel>
  );
}

function CopyInstructionsButton() {
  const organization = useOrganization();

  return (
    <CopyMarkdownButton
      title={t('Copies setup instructions as Markdown, optimized for use with an LLM.')}
      source="agent_monitoring_onboarding"
      getMarkdown={() => LLM_ONBOARDING_COPY_MARKDOWN}
      onCopy={() => {
        trackAnalytics('agent-monitoring.copy-llm-prompt-click', {
          organization,
        });
      }}
    />
  );
}

export function UnsupportedPlatformOnboarding({
  project,
  platformName,
  dsn,
}: {
  platformName: string;
  project: Project;
  dsn?: string;
}) {
  return (
    <OnboardingPanel project={project} dsn={dsn} hasPlatformInstructions={false}>
      <DescriptionWrapper>
        <p>
          {tct(
            'Fiddlesticks. Auto instrumentation of AI Agents is not available for your [platform] project.',
            {
              platform: platformName,
            }
          )}
        </p>
        <p>
          {tct(
            'You can [link:manually instrument] your agents using the Sentry SDK tracing API, or click [bold:Copy instructions] to have an AI coding agent do it for you.',
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
              bold: <strong />,
            }
          )}
        </p>
        <CopyInstructionsButton />
      </DescriptionWrapper>
    </OnboardingPanel>
  );
}

export function NoDocsOnboarding({project, dsn}: {project: Project; dsn?: string}) {
  return (
    <OnboardingPanel project={project} dsn={dsn} hasPlatformInstructions={false}>
      <DescriptionWrapper>
        <p>
          {tct(
            "The agent monitoring onboarding checklist isn't available for your [project] project yet.",
            {project: project.slug}
          )}
        </p>
        <p>
          {tct(
            'You can set up the Sentry SDK by following our [link:documentation], or click [bold:Copy instructions] to have an AI coding agent do it for you.',
            {
              link: <ExternalLink href={AI_AGENTS_GETTING_STARTED_DOCS_LINK} />,
              bold: <strong />,
            }
          )}
        </p>
        <CopyInstructionsButton />
      </DescriptionWrapper>
    </OnboardingPanel>
  );
}

const EventWaitingIndicator = styled((p: React.HTMLAttributes<HTMLDivElement>) => (
  <div {...p}>
    {t("Waiting for this project's first agent events")}
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
`;

const BodyTitle = styled('div')`
  font-size: ${p => p.theme.font.size.xl};
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

const Body = styled('div')`
  display: grid;
  position: relative;
  grid-auto-columns: minmax(0, 1fr);
  grid-auto-flow: column;

  h4 {
    margin-bottom: 0;
  }
`;

const Arcade = styled('iframe')`
  width: 750px;
  max-width: 100%;
  min-height: 370px;
  margin-top: ${p => p.theme.space['2xl']};
  border: 0;
`;

const Divider = styled('hr')`
  height: 1px;
  width: 95%;
  /* oxlint-disable-next-line @sentry/scraps/use-semantic-token */
  background: ${p => p.theme.tokens.border.primary};
  border: none;
  margin-top: 0;
  margin-bottom: 0;
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

const OptionsWrapper = styled('div')`
  display: flex;
  gap: ${p => p.theme.space.md};
  align-items: center;
  flex-wrap: wrap;
  padding-bottom: ${p => p.theme.space.md};
`;
