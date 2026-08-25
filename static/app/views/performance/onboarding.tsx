import {Fragment, useEffect} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {useQuery} from '@tanstack/react-query';

import emptyStateImg from 'sentry-images/spot/performance-empty-state.svg';
import emptyTraceImg from 'sentry-images/spot/performance-empty-trace.svg';
import tourAlert from 'sentry-images/spot/performance-tour-alert.svg';
import tourCorrelate from 'sentry-images/spot/performance-tour-correlate.svg';
import tourMetrics from 'sentry-images/spot/performance-tour-metrics.svg';
import tourTrace from 'sentry-images/spot/performance-tour-trace.svg';

import {FeatureBadge} from '@sentry/scraps/badge';
import {Button, LinkButton} from '@sentry/scraps/button';
import {EmptyState} from '@sentry/scraps/emptyState';
import {Image as ScrapsImage} from '@sentry/scraps/image';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';

import {UnsupportedAlert} from 'sentry/components/alerts/unsupportedAlert';
import {GuidedSteps} from 'sentry/components/guidedSteps/guidedSteps';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import type {TourStep} from 'sentry/components/modals/featureTourModal';
import {
  FeatureTourModal,
  TourImage,
  TourText,
} from 'sentry/components/modals/featureTourModal';
import {AuthTokenGeneratorProvider} from 'sentry/components/onboarding/gettingStartedDoc/authTokenGenerator';
import {ContentBlocksRenderer} from 'sentry/components/onboarding/gettingStartedDoc/contentBlocks/renderer';
import {OnboardingCodeSnippet} from 'sentry/components/onboarding/gettingStartedDoc/onboardingCodeSnippet';
import {OnboardingCopyMarkdownButton} from 'sentry/components/onboarding/gettingStartedDoc/onboardingCopyMarkdownButton';
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
import {Panel} from 'sentry/components/panels/panel';
import {PanelBody} from 'sentry/components/panels/panelBody';
import {filterProjects} from 'sentry/components/performanceOnboarding/utils';
import {BodyTitle, SetupTitle} from 'sentry/components/updatedEmptyState';
import {
  withoutPerformanceSupport,
  withPerformanceOnboarding,
} from 'sentry/data/platformCategories';
import {otherPlatform, allPlatforms as platforms} from 'sentry/data/platforms';
import {t, tct} from 'sentry/locale';
import {ConfigStore} from 'sentry/stores/configStore';
import {
  OnboardingDrawerKey,
  OnboardingDrawerStore,
} from 'sentry/stores/onboardingDrawerStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {pulsingIndicatorStyles} from 'sentry/styles/pulsingIndicator';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {decodeInteger} from 'sentry/utils/queryString';
import {testableWindowLocation} from 'sentry/utils/testableWindowLocation';
import {useApi} from 'sentry/utils/useApi';
import {useEventWaiter} from 'sentry/utils/useEventWaiter';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {Tab} from 'sentry/views/explore/hooks/useTab';
import {useTracesApiOptions} from 'sentry/views/explore/hooks/useTraces';

import {traceAnalytics} from './newTraceDetails/traceAnalytics';

const performanceSetupUrl =
  'https://docs.sentry.io/performance-monitoring/getting-started/';

const AI_SETUP_PROMPT = 'Please enable Sentry tracing in my app.';

const INSTALL_PLUGIN_COMMAND = `npx @sentry/ai install "${AI_SETUP_PROMPT}"`;

const AGENT_PLUGIN_DOCS_URL = 'https://docs.sentry.io/ai/agent-plugin/';

const TRACING_DOCS_URL = 'https://docs.sentry.io/concepts/key-terms/tracing/';

const docsLink = (
  <LinkButton external href={performanceSetupUrl}>
    {t('Setup')}
  </LinkButton>
);

function doesNotSupportPerformance(project: Project) {
  return project.platform ? withoutPerformanceSupport.has(project.platform) : false;
}

export const PERFORMANCE_TOUR_STEPS: TourStep[] = [
  {
    title: t('Track Application Metrics'),
    image: <TourImage src={tourMetrics} />,
    body: (
      <TourText>
        {t(
          'Monitor your slowest pageloads and APIs to see which users are having the worst time.'
        )}
      </TourText>
    ),
    actions: docsLink,
  },
  {
    title: t('Correlate Errors and Traces'),
    image: <TourImage src={tourCorrelate} />,
    body: (
      <TourText>
        {t(
          'See what errors occurred within a transaction and the impact of those errors.'
        )}
      </TourText>
    ),
    actions: docsLink,
  },
  {
    title: t('Watch and Alert'),
    image: <TourImage src={tourAlert} />,
    body: (
      <TourText>
        {t(
          'Highlight mission-critical pages and APIs and set latency alerts to notify you before things go wrong.'
        )}
      </TourText>
    ),
    actions: docsLink,
  },
  {
    title: t('Trace Across Systems'),
    image: <TourImage src={tourTrace} />,
    body: (
      <TourText>
        {t(
          "Follow a trace from a user's session and drill down to identify any bottlenecks that occur."
        )}
      </TourText>
    ),
  },
];

type OnboardingProps = {
  organization: Organization;
  project: Project;
};

export function LegacyOnboarding({organization, project}: OnboardingProps) {
  const {projects} = useProjects();
  const location = useLocation();

  const {projectsForOnboarding} = filterProjects(projects);

  useEffect(() => {
    if (
      location.hash === '#performance-sidequest' &&
      projectsForOnboarding.some(p => p.id === project.id)
    ) {
      OnboardingDrawerStore.open(OnboardingDrawerKey.PERFORMANCE_ONBOARDING);
    }
  }, [location.hash, projectsForOnboarding, project.id]);

  function handleAdvance(step: number, duration: number) {
    trackAnalytics('performance_views.tour.advance', {
      step,
      duration,
      organization,
    });
  }

  function handleClose(step: number, duration: number) {
    trackAnalytics('performance_views.tour.close', {
      step,
      duration,
      organization,
    });
  }

  const currentPlatform = project.platform;
  const hasPerformanceOnboarding = currentPlatform
    ? withPerformanceOnboarding.has(currentPlatform)
    : false;
  const noPerformanceSupport = doesNotSupportPerformance(project);

  let setupButton = (
    <LinkButton
      variant="primary"
      href="https://docs.sentry.io/performance-monitoring/getting-started/"
      external
    >
      {t('Start Setup')}
    </LinkButton>
  );

  if (hasPerformanceOnboarding) {
    setupButton = (
      <Button
        variant="primary"
        onClick={event => {
          event.preventDefault();
          window.location.hash = 'performance-sidequest';
          OnboardingDrawerStore.open(OnboardingDrawerKey.PERFORMANCE_ONBOARDING);
        }}
      >
        {t('Set Up Tracing')}
      </Button>
    );
  }

  return (
    <Container column="1 / -1">
      {noPerformanceSupport && (
        <UnsupportedAlert projectSlug={project.slug} featureName="Performance" />
      )}
      <Panel>
        <EmptyState
          padding="3xl"
          align="center"
          justify="center"
          illustration={
            <ScrapsImage
              width={{zero: '150px', '3xl': '480px', '4xl': '600px'}}
              loading="eager"
              src={emptyStateImg}
              alt={t(
                'Stylized line chart with purple and orange lines trending upward against a pink background'
              )}
              style={{maxWidth: '100%', userSelect: 'none'}}
            />
          }
          title={t('Pinpoint problems')}
          description={t(
            'Something seem slow? Track down transactions to connect the dots between 10-second page loads and poor-performing API calls or slow database queries.'
          )}
          action={
            <Stack gap="md">
              <ButtonList>{setupButton}</ButtonList>
              <FeatureTourModal
                steps={PERFORMANCE_TOUR_STEPS}
                onAdvance={handleAdvance}
                onCloseModal={handleClose}
                doneUrl={performanceSetupUrl}
                doneText={t('Start Setup')}
              >
                {({showModal}) => (
                  <Button
                    variant="link"
                    onClick={() => {
                      trackAnalytics('performance_views.tour.start', {organization});
                      showModal();
                    }}
                  >
                    {t('Take a Tour')}
                  </Button>
                )}
              </FeatureTourModal>
            </Stack>
          }
        />
      </Panel>
    </Container>
  );
}

function ButtonList({children}: {children: React.ReactNode}) {
  return (
    <Flex direction={{zero: 'column', sm: 'row'}} align="center" gap="md">
      {children}
    </Flex>
  );
}

function OnboardingPanel({
  project,
  receivedFirstTrace,
  children,
}: {
  children: React.ReactNode;
  project: Project;
  receivedFirstTrace: boolean;
}) {
  const organization = useOrganization();

  const noPerformanceSupport = doesNotSupportPerformance(project);

  const trackPromptCopied = (source: 'install_command' | 'prompt') => {
    trackAnalytics('onboarding.ai_prompt_copied', {
      organization,
      platform: project.platform ?? 'unknown',
      product: 'traces',
      source,
    });
  };

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
                <Container flex={{zero: 1, xl: 0.65}}>
                  <Title>{t('Tracing in Sentry')}</Title>
                  <SubTitle>
                    {tct(
                      'Use [tracingLink:tracing] to understand how requests and operations flow through your services and agents, and where they slow down or fail.',
                      {tracingLink: <ExternalLink href={TRACING_DOCS_URL} />}
                    )}
                  </SubTitle>
                  <BulletList>
                    <li>
                      {t(
                        'See related errors, logs, replays, and metrics alongside each trace'
                      )}
                    </li>
                    <li>
                      {t(
                        'Find slow services and operations in the trace view and spot where a problem originated'
                      )}
                    </li>
                    <li>{t('Inspect model calls and tool calls in AI agents')}</li>
                  </BulletList>
                </Container>
                <Container
                  display={{zero: 'none', xl: 'block'}}
                  pointerEvents="none"
                  overflow="hidden"
                  flexShrink={0}
                >
                  <ScrapsImage
                    height="120px"
                    width="auto"
                    src={emptyTraceImg}
                    alt={t(
                      'A winged insect flying above a tilted browser window with abstract interface elements'
                    )}
                  />
                </Container>
              </Flex>
              <Divider />
              <Body>
                {noPerformanceSupport ? null : (
                  <AiSetup>
                    <BodyTitle>
                      <Flex align="center" gap="sm">
                        {t('AI-Assisted Setup')}
                        <FeatureBadge type="experimental" />
                      </Flex>
                    </BodyTitle>
                    <SubTitle>
                      {tct(
                        'First, run this command to install the [pluginLink:Sentry plugin]:',
                        {pluginLink: <ExternalLink href={AGENT_PLUGIN_DOCS_URL} />}
                      )}
                    </SubTitle>
                    <Container marginTop="md" marginBottom="2xl">
                      <OnboardingCodeSnippet
                        language="bash"
                        onCopy={() => trackPromptCopied('install_command')}
                      >
                        {INSTALL_PLUGIN_COMMAND}
                      </OnboardingCodeSnippet>
                    </Container>
                    <SubTitle>{t('Then paste this in your agent of choice:')}</SubTitle>
                    <Container marginTop="md" marginBottom="2xl">
                      <OnboardingCodeSnippet
                        language="text"
                        onCopy={() => trackPromptCopied('prompt')}
                      >
                        {AI_SETUP_PROMPT}
                      </OnboardingCodeSnippet>
                    </Container>
                    {receivedFirstTrace ? (
                      <EventReceivedIndicator />
                    ) : (
                      <EventWaitingIndicator />
                    )}
                  </AiSetup>
                )}
                <Setup>{children}</Setup>
                {noPerformanceSupport ? null : (
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

export function Onboarding({organization, project}: OnboardingProps) {
  const theme = useTheme();
  const api = useApi();
  const location = useLocation();
  const navigate = useNavigate();
  const {isSelfHosted, urlPrefix} = useLegacyStore(ConfigStore);

  const noPerformanceSupport = doesNotSupportPerformance(project);

  const firstIssue = useEventWaiter({
    eventType: 'transaction',
    organization,
    project,
    disabled: noPerformanceSupport,
  });
  const received = !!firstIssue;

  const tracesQuery = useQuery({
    ...useTracesApiOptions({
      limit: 1,
      sort: 'timestamp',
    }),
    enabled: received,
    refetchInterval: query => {
      const trace = query.state.data?.json?.data?.[0]?.trace;
      return trace ? false : 5000; // 5s
    },
  });
  const traceId = tracesQuery.data?.data[0]?.trace;

  const currentPlatform = project.platform
    ? platforms.find(p => p.id === project.platform)
    : undefined;

  const {isLoading, docs, dsn, projectKeyId} = useLoadGettingStarted({
    platform: currentPlatform || otherPlatform,
    orgSlug: organization.slug,
    projSlug: project.slug,
    productType: 'performance',
  });

  const {isPending: isLoadingRegistry, data: registryData} =
    useSourcePackageRegistries(organization);

  useEffect(() => {
    if (isLoading || !currentPlatform || !dsn || !projectKeyId) {
      return;
    }

    traceAnalytics.trackTracingOnboarding(
      organization,
      currentPlatform.id,
      !noPerformanceSupport,
      withPerformanceOnboarding.has(currentPlatform.id)
    );
  }, [currentPlatform, isLoading, dsn, projectKeyId, organization, noPerformanceSupport]);

  const performanceDocs = docs?.performanceOnboarding;

  if (isLoading) {
    return <LoadingIndicator />;
  }

  if (noPerformanceSupport) {
    return (
      <OnboardingPanel project={project} receivedFirstTrace={received}>
        <div>
          {tct(
            'Fiddlesticks. Performance isn’t available for your [platform] project yet but we’re definitely still working on it. Stay tuned.',
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
              traceAnalytics.trackPlatformDocsViewed(
                organization,
                currentPlatform?.id ?? project.platform ?? 'unknown'
              );
            }}
          >
            {t('Go to Documentation')}
          </LinkButton>
        </div>
      </OnboardingPanel>
    );
  }

  if (!currentPlatform || !performanceDocs || !dsn || !projectKeyId) {
    return (
      <OnboardingPanel project={project} receivedFirstTrace={received}>
        <div>
          {tct('Read the docs to instrument tracing in your [platform] project', {
            platform: currentPlatform?.name || project.slug,
          })}
        </div>
        <br />
        <div>
          <LinkButton
            size="sm"
            href="https://docs.sentry.io/product/trace-explorer/"
            external
            onClick={() => {
              traceAnalytics.trackPerformanceSetupDocsViewed(
                organization,
                currentPlatform?.id ?? project.platform ?? 'unknown'
              );
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
    platformOptions: [ProductSolution.PERFORMANCE_MONITORING],
    feedbackOptions: {},
    urlPrefix,
    isSelfHosted,
  };

  const installSteps = performanceDocs.install(docParams);
  const configureSteps = performanceDocs.configure(docParams);
  const verifySteps = performanceDocs.verify(docParams);

  const steps = [...installSteps, ...configureSteps, ...verifySteps];

  return (
    <OnboardingPanel project={project} receivedFirstTrace={received}>
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
                index === 0 ? (
                  <OnboardingCopyMarkdownButton
                    borderless
                    steps={steps}
                    source="performance_onboarding"
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
                <Fragment>
                  <GuidedSteps.ButtonWrapper>
                    <GuidedSteps.BackButton size="md" />
                    {received ? (
                      <Button
                        variant="primary"
                        busy={!traceId}
                        tooltipProps={{
                          title: traceId ? undefined : t('Processing trace\u2026'),
                        }}
                        onClick={() => {
                          const params = new URLSearchParams(window.location.search);
                          params.set('table', Tab.TRACE);
                          params.set('query', `trace:${traceId}`);
                          params.delete('guidedStep');
                          testableWindowLocation.assign(
                            `${window.location.pathname}?${params.toString()}`
                          );
                        }}
                      >
                        {t('Take me to my trace')}
                      </Button>
                    ) : null}
                  </GuidedSteps.ButtonWrapper>
                </Fragment>
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

const EventWaitingIndicator = styled((p: React.HTMLAttributes<HTMLDivElement>) => (
  <div {...p}>
    {t("Waiting for this project's first trace")}
    <PulsingIndicator />
  </div>
))`
  display: flex;
  align-items: center;
  position: relative;
  z-index: 10;
  flex-grow: 1;
  font-size: ${p => p.theme.font.size.md};
  color: ${p => p.theme.colors.pink500};
  /* Keeps the pulsing dot clear of the centered "OR" divider. */
  padding-right: ${p => p.theme.space['3xl']};
`;

const PulsingIndicator = styled('div')`
  ${pulsingIndicatorStyles};
  margin-left: ${p => p.theme.space.md};
  flex-shrink: 0;
`;

const EventReceivedIndicator = styled((p: React.HTMLAttributes<HTMLDivElement>) => (
  <div {...p}>
    {'🎉 '}
    {t("We've received this project's first trace!")}
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

const AiSetup = styled('div')`
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

const Setup = styled('div')`
  padding: ${p => p.theme.space['3xl']};
`;

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

const Divider = styled('hr')`
  height: 1px;
  width: 95%;
  /* eslint-disable-next-line @sentry/scraps/use-semantic-token */
  background: ${p => p.theme.tokens.border.primary};
  border: none;
  margin-top: 0;
  margin-bottom: 0;
`;
