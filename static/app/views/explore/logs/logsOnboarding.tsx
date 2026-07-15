import {Fragment, useEffect} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import connectDotsImg from 'sentry-images/spot/performance-connect-dots.svg';

import {FeatureBadge} from '@sentry/scraps/badge';
import {LinkButton} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';

import {GuidedSteps} from 'sentry/components/guidedSteps/guidedSteps';
import * as Layout from 'sentry/components/layouts/thirds';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {AuthTokenGeneratorProvider} from 'sentry/components/onboarding/gettingStartedDoc/authTokenGenerator';
import {ContentBlocksRenderer} from 'sentry/components/onboarding/gettingStartedDoc/contentBlocks/renderer';
import {OnboardingCodeSnippet} from 'sentry/components/onboarding/gettingStartedDoc/onboardingCodeSnippet';
import {
  OnboardingCopyMarkdownButton,
  useCopySetupInstructionsEnabled,
} from 'sentry/components/onboarding/gettingStartedDoc/onboardingCopyMarkdownButton';
import {
  StepIndexProvider,
  TabSelectionScope,
} from 'sentry/components/onboarding/gettingStartedDoc/selectedCodeTabContext';
import type {DocsParams} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  ProductSolution,
  StepType,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {useSourcePackageRegistries} from 'sentry/components/onboarding/gettingStartedDoc/useSourcePackageRegistries';
import {useLoadGettingStarted} from 'sentry/components/onboarding/gettingStartedDoc/utils/useLoadGettingStarted';
import type {DatePageFilterProps} from 'sentry/components/pageFilters/date/datePageFilter';
import {DatePageFilter} from 'sentry/components/pageFilters/date/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/pageFilters/environment/environmentPageFilter';
import {ProjectPageFilter} from 'sentry/components/pageFilters/project/projectPageFilter';
import {Panel} from 'sentry/components/panels/panel';
import {PanelBody} from 'sentry/components/panels/panelBody';
import {BodyTitle, SetupTitle} from 'sentry/components/updatedEmptyState';
import {withoutLoggingSupport} from 'sentry/data/platformCategories';
import {otherPlatform, allPlatforms as platforms} from 'sentry/data/platforms';
import {t, tct} from 'sentry/locale';
import {ConfigStore} from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {pulsingIndicatorStyles} from 'sentry/styles/pulsingIndicator';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {decodeInteger} from 'sentry/utils/queryString';
import {useApi} from 'sentry/utils/useApi';
import {useEventWaiter} from 'sentry/utils/useEventWaiter';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  ExploreBodySearch,
  ExploreFilterSection,
} from 'sentry/views/explore/components/styles';
import {SetupLogsButton} from 'sentry/views/explore/logs/setupLogsButton';
import {StyledPageFilterBar} from 'sentry/views/explore/logs/styles';

// eslint-disable-next-line boundaries/dependencies
import QuotaExceededAlert from 'getsentry/components/performance/quotaExceededAlert';

type OnboardingProps = {
  organization: Organization;
  project: Project;
};

const AI_SETUP_PROMPT =
  'Please instrument Sentry logging. Include some examples following best practices.';

const INSTALL_PLUGIN_COMMAND = `npx @sentry/ai install "${AI_SETUP_PROMPT}"`;

const LOG_DRAIN_PLATFORM_DOCS: Record<string, {name: string; url: string}> = {
  'node-cloudflare-pages': {
    name: 'Cloudflare',
    url: 'https://docs.sentry.io/product/drains/integration/cloudflare/',
  },
  'node-cloudflare-workers': {
    name: 'Cloudflare',
    url: 'https://docs.sentry.io/product/drains/integration/cloudflare/',
  },
};

function LogDrainsLink({project}: {project: Project}) {
  const platformDoc = project.platform
    ? LOG_DRAIN_PLATFORM_DOCS[project.platform]
    : undefined;

  return (
    <LogDrainsLinkWrapper>
      <BodyTitle>{t('Log Drains and Forwarders')}</BodyTitle>
      <SubTitle>
        {platformDoc
          ? tct(
              'You can use [link:Log Drains] to send logs from platforms like [platformLink], or via the [otlpLink:OpenTelemetry Collector].',
              {
                link: <ExternalLink href="https://docs.sentry.io/product/drains/" />,
                platformLink: (
                  <ExternalLink href={platformDoc.url}>{platformDoc.name}</ExternalLink>
                ),
                otlpLink: (
                  <ExternalLink href="https://docs.sentry.io/product/drains/integration/opentelemetry-collector/" />
                ),
              }
            )
          : tct(
              'You can use [link:Log Drains] to send logs from platforms like [vercelLink:Vercel], or via the [otlpLink:OpenTelemetry Collector].',
              {
                link: <ExternalLink href="https://docs.sentry.io/product/drains/" />,
                vercelLink: (
                  <ExternalLink href="https://docs.sentry.io/product/drains/integration/vercel/" />
                ),
                otlpLink: (
                  <ExternalLink href="https://docs.sentry.io/product/drains/integration/opentelemetry-collector/" />
                ),
              }
            )}
      </SubTitle>
    </LogDrainsLinkWrapper>
  );
}

function OnboardingPanel({
  project,
  children,
}: {
  children: React.ReactNode;
  project: Project;
}) {
  const organization = useOrganization();

  const doesNotSupportLogging = project.platform
    ? withoutLoggingSupport.has(project.platform)
    : false;

  const receivedFirstLog = !!useEventWaiter({
    eventType: 'log',
    organization,
    project,
    disabled: doesNotSupportLogging,
  });

  const trackPromptCopied = (source: 'install_command' | 'prompt') => {
    trackAnalytics('logs.onboarding_ai_prompt_copied', {
      organization,
      platform: project.platform ?? 'unknown',
      source,
    });
  };

  return (
    <Panel>
      <PanelBody>
        <AuthTokenGeneratorProvider projectSlug={project?.slug}>
          <TabSelectionScope>
            <div>
              <HeaderWrapper>
                <HeaderText>
                  <Title>{t('Logs in Sentry')}</Title>
                  <SubTitle>
                    {t('Search and visualize application logs at scale.')}
                  </SubTitle>
                  <BulletList>
                    <li>{t('View logs in context with errors and traces')}</li>
                    <li>{t('Query, filter, and group logs by any attribute')}</li>
                    <li>
                      {t('Build alerts and dashboard widgets based on log queries')}
                    </li>
                  </BulletList>
                </HeaderText>
                <Image src={connectDotsImg} />
              </HeaderWrapper>
              <Divider />
              <Body>
                <Setup>
                  {children}
                  <LogDrainsLink project={project} />
                </Setup>
                <Preview>
                  {doesNotSupportLogging ? (
                    // Platforms without logging support can't run the AI-assisted
                    // setup (and would never receive a first log), so show the
                    // product preview instead of the setup prompts.
                    <Fragment>
                      <BodyTitle>{t('Preview a Sentry Log')}</BodyTitle>
                      <Arcade
                        src="https://demo.arcade.software/dLjHGrPJITrt7JKpmX5V?embed"
                        loading="lazy"
                        allowFullScreen
                      />
                    </Fragment>
                  ) : (
                    <Fragment>
                      <BodyTitle>
                        <Flex align="center" gap="sm">
                          {t('AI-Assisted Setup')}
                          <FeatureBadge type="experimental" />
                        </Flex>
                      </BodyTitle>
                      <SubTitle>
                        {t('First, run this command to install the Sentry plugin')}
                      </SubTitle>
                      <PromptSnippet>
                        <OnboardingCodeSnippet
                          language="bash"
                          onCopy={() => trackPromptCopied('install_command')}
                        >
                          {INSTALL_PLUGIN_COMMAND}
                        </OnboardingCodeSnippet>
                      </PromptSnippet>
                      <SubTitle>{t('Then paste this in your agent of choice')}</SubTitle>
                      <PromptSnippet>
                        <OnboardingCodeSnippet
                          language="text"
                          onCopy={() => trackPromptCopied('prompt')}
                        >
                          {AI_SETUP_PROMPT}
                        </OnboardingCodeSnippet>
                      </PromptSnippet>
                      {receivedFirstLog ? (
                        <EventReceivedIndicator />
                      ) : (
                        <EventWaitingIndicator />
                      )}
                    </Fragment>
                  )}
                </Preview>
                {doesNotSupportLogging ? null : (
                  <OrDivider aria-hidden>{t('OR')}</OrDivider>
                )}
              </Body>
            </div>
          </TabSelectionScope>
        </AuthTokenGeneratorProvider>
      </PanelBody>
    </Panel>
  );
}

const STEP_TITLES: Record<StepType, string> = {
  [StepType.INSTALL]: t('Install Sentry'),
  [StepType.CONFIGURE]: t('Configure Sentry'),
  [StepType.VERIFY]: t('Verify Sentry'),
};

function Onboarding({organization, project}: OnboardingProps) {
  const theme = useTheme();
  const api = useApi();
  const location = useLocation();
  const navigate = useNavigate();
  const {isSelfHosted, urlPrefix} = useLegacyStore(ConfigStore);
  const copyEnabled = useCopySetupInstructionsEnabled();
  const currentPlatform = project.platform
    ? platforms.find(p => p.id === project.platform)
    : undefined;

  const {isLoading, docs, dsn, projectKeyId} = useLoadGettingStarted({
    platform: currentPlatform || otherPlatform,
    orgSlug: organization.slug,
    projSlug: project.slug,
    productType: 'logs',
  });

  const {isPending: isLoadingRegistry, data: registryData} =
    useSourcePackageRegistries(organization);

  const doesNotSupportLogging = project.platform
    ? withoutLoggingSupport.has(project.platform)
    : false;

  const analyticsPlatform = currentPlatform?.id ?? project.platform ?? 'unknown';

  useEffect(() => {
    if (isLoading || !currentPlatform || !dsn || !projectKeyId) {
      return;
    }

    trackAnalytics('logs.onboarding', {
      organization,
      platform: analyticsPlatform,
      supports_onboarding_checklist: !doesNotSupportLogging,
    });
  }, [
    currentPlatform,
    isLoading,
    dsn,
    projectKeyId,
    organization,
    doesNotSupportLogging,
    analyticsPlatform,
  ]);

  const logsDocs = docs?.logsOnboarding ?? docs?.onboarding;

  if (isLoading) {
    return <LoadingIndicator />;
  }

  if (doesNotSupportLogging) {
    return (
      <OnboardingPanel project={project}>
        <div>
          {tct(
            'Fiddlesticks. Application Logging isn’t available for your [platform] project yet, but we’re definitely still working on it. Stay tuned.',
            {platform: currentPlatform?.name || project.slug}
          )}
        </div>
        <br />
        <div>
          <LinkButton
            size="sm"
            href="https://docs.sentry.io/platforms/"
            external
            onClick={() => {
              trackAnalytics('logs.onboarding_platform_docs_viewed', {
                organization,
                platform: analyticsPlatform,
              });
            }}
          >
            {t('Go to Documentation')}
          </LinkButton>
        </div>
      </OnboardingPanel>
    );
  }

  if (!currentPlatform || !logsDocs || !dsn || !projectKeyId) {
    return (
      <OnboardingPanel project={project}>
        <div>
          {tct(
            'Fiddlesticks. The logging onboarding checklist isn’t available for your [project] project yet, but for now, go to Sentry docs for installation details.',
            {project: project.slug}
          )}
        </div>
        <br />
        <div>
          <LinkButton
            size="sm"
            href="https://docs.sentry.io/product/explore/logs/getting-started/"
            external
            onClick={() => {
              trackAnalytics('logs.onboarding_platform_docs_viewed', {
                organization,
                platform: analyticsPlatform,
              });
            }}
          >
            {t('Go to Documentation')}
          </LinkButton>
        </div>
      </OnboardingPanel>
    );
  }

  const docParams: DocsParams<any> = {
    api,
    projectKeyId,
    dsn,
    organization,
    platformKey: project.platform || 'other',
    project,
    isLogsSelected: true,
    isMetricsSelected: false,
    isFeedbackSelected: false,
    isPerformanceSelected: false,
    isProfilingSelected: false,
    isReplaySelected: false,
    sourcePackageRegistries: {
      isLoading: isLoadingRegistry,
      data: registryData,
    },
    platformOptions: [ProductSolution.LOGS],
    newOrg: false,
    feedbackOptions: {},
    urlPrefix,
    isSelfHosted,
  };

  const installSteps = logsDocs.install(docParams);
  const configureSteps = logsDocs.configure(docParams);
  const verifySteps = logsDocs.verify(docParams);

  const steps = [...installSteps, ...configureSteps, ...verifySteps];

  return (
    <OnboardingPanel project={project}>
      <SetupTitle project={project} />
      <GuidedSteps
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
        {steps.map((step, index) => {
          const title = step.title ?? STEP_TITLES[step.type];
          return (
            <GuidedSteps.Step
              key={title}
              stepKey={title}
              title={title}
              trailingItems={
                index === 0 && copyEnabled ? (
                  <OnboardingCopyMarkdownButton
                    borderless
                    steps={steps}
                    source="logs_onboarding"
                  />
                ) : undefined
              }
            >
              <StepIndexProvider index={index}>
                <ContentBlocksRenderer
                  spacing={theme.space.md}
                  contentBlocks={step.content}
                />
              </StepIndexProvider>
              {index === steps.length - 1 ? (
                <GuidedSteps.ButtonWrapper>
                  <GuidedSteps.BackButton size="md" />
                </GuidedSteps.ButtonWrapper>
              ) : (
                <GuidedSteps.ButtonWrapper>
                  <GuidedSteps.BackButton size="md" />
                  <GuidedSteps.NextButton size="md" />
                </GuidedSteps.ButtonWrapper>
              )}
            </GuidedSteps.Step>
          );
        })}
      </GuidedSteps>
    </OnboardingPanel>
  );
}

const PulsingIndicator = styled('div')`
  ${pulsingIndicatorStyles};
  flex-shrink: 0;
`;

const EventWaitingIndicator = styled((p: React.HTMLAttributes<HTMLDivElement>) => (
  <div {...p}>
    {t("Waiting for this project's first log")}
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

const EventReceivedIndicator = styled((p: React.HTMLAttributes<HTMLDivElement>) => (
  <div {...p}>
    {'🎉 '}
    {t("We've received this project's first log!")}
  </div>
))`
  display: flex;
  align-items: center;
  flex-grow: 1;
  font-size: ${p => p.theme.font.size.md};
  color: ${p => p.theme.tokens.content.success};
`;

const SubTitle = styled('div')`
  margin-bottom: ${p => p.theme.space.md};
`;

const LogDrainsLinkWrapper = styled('div')`
  padding-top: ${p => p.theme.space.xl};
`;

const Title = styled('div')`
  font-size: 26px;
  font-weight: ${p => p.theme.font.weight.sans.medium};
`;

const BulletList = styled('ul')`
  list-style-type: disc;
  padding-left: 20px;
  margin-bottom: ${p => p.theme.space.xl};

  li {
    margin-bottom: ${p => p.theme.space.md};
  }
`;

const HeaderWrapper = styled('div')`
  display: flex;
  justify-content: space-between;
  gap: ${p => p.theme.space['2xl']};
  border-radius: ${p => p.theme.radius.md};
  padding: ${p => p.theme.space['3xl']};
`;

const HeaderText = styled('div')`
  flex: 0.65;

  @media (max-width: ${p => p.theme.breakpoints.sm}) {
    flex: 1;
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

const Preview = styled('div')`
  padding: ${p => p.theme.space['3xl']};
`;

// Sits on top of the vertical divider (Setup's :after) at the horizontal center
// of Body, with a panel-colored background to break the line.
const OrDivider = styled('div')`
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  z-index: 1;
  padding: ${p => p.theme.space.sm};
  background: ${p => p.theme.tokens.background.primary};
  color: ${p => p.theme.tokens.content.secondary};
  font-size: ${p => p.theme.font.size.sm};
  font-weight: ${p => p.theme.font.weight.sans.medium};
  letter-spacing: 0.05em;
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

const Image = styled('img')`
  display: block;
  pointer-events: none;
  height: 120px;
  overflow: hidden;

  @media (max-width: ${p => p.theme.breakpoints.sm}) {
    display: none;
  }
`;

const Divider = styled('hr')`
  height: 1px;
  width: 95%;
  /* eslint-disable-next-line @sentry/scraps/use-semantic-token */
  background: ${p => p.theme.tokens.border.primary};
  border: none;
  margin-top: 0;
  margin-bottom: 0;
`;

// Wrapper keeps the code block sized to its content instead of stretching to
// fill the (tall) preview column.
const PromptSnippet = styled('div')`
  margin-top: ${p => p.theme.space.md};
  margin-bottom: ${p => p.theme.space['2xl']};
`;

const OnboardingContainer = styled('div')`
  margin-top: ${p => p.theme.space.md};
`;

const Arcade = styled('iframe')`
  width: 750px;
  max-width: 100%;
  margin-top: ${p => p.theme.space['2xl']};
  height: 522px;
  border: 0;
`;

type LogsTabOnboardingProps = {
  datePageFilterProps: DatePageFilterProps;
  organization: Organization;
  project: Project;
};

export function LogsTabOnboarding({
  organization,
  project,
  datePageFilterProps,
}: LogsTabOnboardingProps) {
  return (
    <ExploreBodySearch>
      <Layout.Main width="full">
        <ExploreFilterSection>
          <StyledPageFilterBar condensed>
            <ProjectPageFilter />
            <EnvironmentPageFilter />
            <DatePageFilter {...datePageFilterProps} />
          </StyledPageFilterBar>
          <Flex align="center" justify="end">
            <SetupLogsButton />
          </Flex>
        </ExploreFilterSection>
        <OnboardingContainer>
          <QuotaExceededAlert referrer="logs-explore" traceItemDataset="logs" />
          <Onboarding project={project} organization={organization} />
        </OnboardingContainer>
      </Layout.Main>
    </ExploreBodySearch>
  );
}
