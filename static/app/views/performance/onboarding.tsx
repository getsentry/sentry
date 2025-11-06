import {Fragment, useEffect, useState} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import emptyStateImg from 'sentry-images/spot/performance-empty-state.svg';
import emptyTraceImg from 'sentry-images/spot/performance-empty-trace.svg';
import tourAlert from 'sentry-images/spot/performance-tour-alert.svg';
import tourCorrelate from 'sentry-images/spot/performance-tour-correlate.svg';
import tourMetrics from 'sentry-images/spot/performance-tour-metrics.svg';
import tourTrace from 'sentry-images/spot/performance-tour-trace.svg';

import {
  addErrorMessage,
  addLoadingMessage,
  clearIndicators,
} from 'sentry/actionCreators/indicator';
import type {Client} from 'sentry/api';
import UnsupportedAlert from 'sentry/components/alerts/unsupportedAlert';
import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {GuidedSteps} from 'sentry/components/guidedSteps/guidedSteps';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import type {TourStep} from 'sentry/components/modals/featureTourModal';
import FeatureTourModal, {
  TourImage,
  TourText,
} from 'sentry/components/modals/featureTourModal';
import {AuthTokenGeneratorProvider} from 'sentry/components/onboarding/gettingStartedDoc/authTokenGenerator';
import {ContentBlocksRenderer} from 'sentry/components/onboarding/gettingStartedDoc/contentBlocks/renderer';
import type {DocsParams} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  ProductSolution,
  StepType,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {useSourcePackageRegistries} from 'sentry/components/onboarding/gettingStartedDoc/useSourcePackageRegistries';
import {useLoadGettingStarted} from 'sentry/components/onboarding/gettingStartedDoc/utils/useLoadGettingStarted';
import LegacyOnboardingPanel from 'sentry/components/onboardingPanel';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import {filterProjects} from 'sentry/components/performanceOnboarding/utils';
import {BodyTitle, SetupTitle} from 'sentry/components/updatedEmptyState';
import {
  withoutPerformanceSupport,
  withPerformanceOnboarding,
} from 'sentry/data/platformCategories';
import platforms, {otherPlatform} from 'sentry/data/platforms';
import {t, tct} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import OnboardingDrawerStore, {
  OnboardingDrawerKey,
} from 'sentry/stores/onboardingDrawerStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import pulsingIndicatorStyles from 'sentry/styles/pulsingIndicator';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {browserHistory} from 'sentry/utils/browserHistory';
import {generateLinkToEventInTraceView} from 'sentry/utils/discover/urls';
import EventWaiter from 'sentry/utils/eventWaiter';
import {decodeInteger} from 'sentry/utils/queryString';
import {testableWindowLocation} from 'sentry/utils/testableWindowLocation';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useProjects from 'sentry/utils/useProjects';
import {Tab} from 'sentry/views/explore/hooks/useTab';
import {useTraces} from 'sentry/views/explore/hooks/useTraces';

import {traceAnalytics} from './newTraceDetails/traceAnalytics';

const performanceSetupUrl =
  'https://docs.sentry.io/performance-monitoring/getting-started/';

const docsLink = (
  <LinkButton external href={performanceSetupUrl}>
    {t('Setup')}
  </LinkButton>
);

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

type SampleButtonProps = {
  api: Client;
  errorMessage: React.ReactNode;
  loadingMessage: React.ReactNode;
  organization: Organization;
  project: Project;
  triggerText: React.ReactNode;
};

function SampleButton({
  triggerText,
  loadingMessage,
  errorMessage,
  project,
  organization,
  api,
}: SampleButtonProps) {
  const location = useLocation();
  return (
    <Button
      data-test-id="create-sample-transaction-btn"
      onClick={async () => {
        trackAnalytics('performance_views.create_sample_transaction', {
          platform: project.platform,
          organization,
        });
        addLoadingMessage(loadingMessage, {
          duration: 15000,
        });
        const url = `/projects/${organization.slug}/${project.slug}/create-sample-transaction/`;
        try {
          const eventData = await api.requestPromise(url, {method: 'POST'});
          const traceSlug = eventData.contexts?.trace?.trace_id ?? '';

          browserHistory.push(
            generateLinkToEventInTraceView({
              eventId: eventData.eventID,
              location,
              organization,
              timestamp: eventData.endTimestamp,
              traceSlug,
              demo: `${project.slug}:${eventData.eventID}`,
            })
          );
          clearIndicators();
        } catch (error) {
          Sentry.withScope(scope => {
            scope.setExtra('error', error);
            Sentry.captureException(new Error('Failed to create sample event'));
          });
          clearIndicators();
          addErrorMessage(errorMessage);
          return;
        }
      }}
    >
      {triggerText}
    </Button>
  );
}

type OnboardingProps = {
  organization: Organization;
  project: Project;
};

export function LegacyOnboarding({organization, project}: OnboardingProps) {
  const api = useApi();
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
  const noPerformanceSupport =
    currentPlatform && withoutPerformanceSupport.has(currentPlatform);

  let setupButton = (
    <LinkButton
      priority="primary"
      href="https://docs.sentry.io/performance-monitoring/getting-started/"
      external
    >
      {t('Start Setup')}
    </LinkButton>
  );

  if (hasPerformanceOnboarding) {
    setupButton = (
      <Button
        priority="primary"
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
    <PerformanceOnboardingContainer>
      {noPerformanceSupport && (
        <UnsupportedAlert projectSlug={project.slug} featureName="Performance" />
      )}
      <LegacyOnboardingPanel image={<PerfImage src={emptyStateImg} />}>
        <h3>{t('Pinpoint problems')}</h3>
        <p>
          {t(
            'Something seem slow? Track down transactions to connect the dots between 10-second page loads and poor-performing API calls or slow database queries.'
          )}
        </p>
        <ButtonList>
          {setupButton}
          <SampleButton
            triggerText={t('View Sample Transaction')}
            loadingMessage={t('Processing sample transaction...')}
            errorMessage={t('Failed to create sample transaction')}
            organization={organization}
            project={project}
            api={api}
          />
        </ButtonList>
        <FeatureTourModal
          steps={PERFORMANCE_TOUR_STEPS}
          onAdvance={handleAdvance}
          onCloseModal={handleClose}
          doneUrl={performanceSetupUrl}
          doneText={t('Start Setup')}
        >
          {({showModal}) => (
            <Button
              priority="link"
              onClick={() => {
                trackAnalytics('performance_views.tour.start', {organization});
                showModal();
              }}
            >
              {t('Take a Tour')}
            </Button>
          )}
        </FeatureTourModal>
      </LegacyOnboardingPanel>
    </PerformanceOnboardingContainer>
  );
}

const PerformanceOnboardingContainer = styled('div')`
  grid-column: 1/-1;
`;

const PerfImage = styled('img')`
  @media (min-width: ${p => p.theme.breakpoints.sm}) {
    max-width: unset;
    user-select: none;
    position: absolute;
    top: 75px;
    bottom: 0;
    width: 450px;
    margin-top: auto;
    margin-bottom: auto;
  }

  @media (min-width: ${p => p.theme.breakpoints.md}) {
    width: 480px;
  }

  @media (min-width: ${p => p.theme.breakpoints.lg}) {
    width: 600px;
  }
`;

const ButtonList = styled(ButtonBar)`
  grid-template-columns: repeat(auto-fit, minmax(130px, max-content));
  margin-bottom: 16px;
`;

function OnboardingPanel({
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
          <div>
            <HeaderWrapper>
              <HeaderText>
                <Title>{t('Query for Traces, Get Answers')}</Title>
                <SubTitle>
                  {t(
                    'You can query and aggregate spans to create metrics that help you debug busted API calls, slow image loads, or any other metrics you’d like to track.'
                  )}
                </SubTitle>
                <BulletList>
                  <li>
                    {t(
                      'Find traces tied to a user complaint and pinpoint exactly what broke'
                    )}
                  </li>
                  <li>
                    {t(
                      'Debug persistent issues by investigating API payloads, cache sizes, user tokens, and more'
                    )}
                  </li>
                  <li>
                    {t(
                      'Track any span attribute as a metric to catch slowdowns before they escalate'
                    )}
                  </li>
                </BulletList>
              </HeaderText>
              <Image src={emptyTraceImg} />
            </HeaderWrapper>
            <Divider />
            <Body>
              <Setup>{children}</Setup>
              <Preview>
                <BodyTitle>{t('Preview a Sentry Trace')}</BodyTitle>
                <Arcade
                  src="https://demo.arcade.software/BPVB65UiYCxixEw8bnmj?embed"
                  loading="lazy"
                  allowFullScreen
                />
              </Preview>
            </Body>
          </div>
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
  const api = useApi();
  const location = useLocation();
  const navigate = useNavigate();
  const {isSelfHosted, urlPrefix} = useLegacyStore(ConfigStore);
  const [received, setReceived] = useState<boolean>(false);
  const showNewUi = organization.features.includes('tracing-onboarding-new-ui');
  const isEAPTraceEnabled = organization.features.includes('trace-spans-format');
  const tracesQuery = useTraces({
    enabled: received,
    limit: 1,
    sort: 'timestamp',
    refetchInterval: query => {
      const trace = query.state.data?.[0]?.data?.[0]?.trace;
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

  const doesNotSupportPerformance = project.platform
    ? withoutPerformanceSupport.has(project.platform)
    : false;

  useEffect(() => {
    if (isLoading || !currentPlatform || !dsn || !projectKeyId) {
      return;
    }

    traceAnalytics.trackTracingOnboarding(
      organization,
      currentPlatform.id,
      !doesNotSupportPerformance,
      withPerformanceOnboarding.has(currentPlatform.id)
    );
  }, [
    currentPlatform,
    isLoading,
    dsn,
    projectKeyId,
    organization,
    doesNotSupportPerformance,
  ]);

  if (!showNewUi) {
    return <LegacyOnboarding organization={organization} project={project} />;
  }

  const performanceDocs = docs?.performanceOnboarding;

  if (isLoading) {
    return <LoadingIndicator />;
  }

  if (doesNotSupportPerformance) {
    return (
      <OnboardingPanel project={project}>
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
      <OnboardingPanel project={project}>
        <div>
          {tct(
            'Fiddlesticks. The tracing onboarding checklist isn’t available for your [project] project yet, but for now, go to Sentry docs for installation details.',
            {project: project.slug}
          )}
        </div>
        <br />
        <div>
          <LinkButton
            size="sm"
            href="https://docs.sentry.io/product/performance/getting-started/"
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
    newOrg: false,
    feedbackOptions: {},
    urlPrefix,
    isSelfHosted,
  };

  const installSteps = performanceDocs.install(docParams);
  const configureSteps = performanceDocs.configure(docParams);
  const verifySteps = performanceDocs.verify(docParams);

  const steps = [...installSteps, ...configureSteps, ...verifySteps];

  const eventWaitingIndicator = (
    <EventWaiter
      api={api}
      organization={organization}
      project={project}
      eventType="transaction"
      onIssueReceived={() => {
        setReceived(true);
      }}
    >
      {({firstIssue}) =>
        firstIssue ? <EventReceivedIndicator /> : <EventWaitingIndicator />
      }
    </EventWaiter>
  );

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
            <GuidedSteps.Step key={title} stepKey={title} title={title}>
              <ContentBlocksRenderer spacing={space(1)} contentBlocks={step.content} />
              {index === steps.length - 1 ? (
                <Fragment>
                  {eventWaitingIndicator}
                  <GuidedSteps.ButtonWrapper>
                    <GuidedSteps.BackButton size="md" />
                    {received ? (
                      <Button
                        priority="primary"
                        busy={!traceId}
                        title={traceId ? undefined : t('Processing trace\u2026')}
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
                    ) : isEAPTraceEnabled ? null : (
                      <SampleButton
                        triggerText={t('Take me to an example')}
                        loadingMessage={t('Processing sample trace...')}
                        errorMessage={t('Failed to create sample trace')}
                        organization={organization}
                        project={project}
                        api={api}
                      />
                    )}
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
  font-size: ${p => p.theme.fontSize.md};
  color: ${p => p.theme.pink400};
`;

const PulsingIndicator = styled('div')`
  ${pulsingIndicatorStyles};
  margin-left: ${space(1)};
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
  font-size: ${p => p.theme.fontSize.md};
  color: ${p => p.theme.successText};
`;

const SubTitle = styled('div')`
  margin-bottom: ${space(1)};
`;

const Title = styled('div')`
  font-size: 26px;
  font-weight: ${p => p.theme.fontWeight.bold};
`;

const BulletList = styled('ul')`
  list-style-type: disc;
  padding-left: 20px;
  margin-bottom: ${space(2)};

  li {
    margin-bottom: ${space(1)};
  }
`;

const HeaderWrapper = styled('div')`
  display: flex;
  justify-content: space-between;
  gap: ${space(3)};
  border-radius: ${p => p.theme.borderRadius};
  padding: ${space(4)};
`;

const HeaderText = styled('div')`
  flex: 0.65;

  @media (max-width: ${p => p.theme.breakpoints.sm}) {
    flex: 1;
  }
`;

const Setup = styled('div')`
  padding: ${space(4)};

  &:after {
    content: '';
    position: absolute;
    right: 50%;
    top: 2.5%;
    height: 95%;
    border-right: 1px ${p => p.theme.border} solid;
  }
`;

const Preview = styled('div')`
  padding: ${space(4)};
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
  background: ${p => p.theme.border};
  border: none;
  margin-top: 0;
  margin-bottom: 0;
`;

const Arcade = styled('iframe')`
  width: 750px;
  max-width: 100%;
  margin-top: ${space(3)};
  height: 522px;
  border: 0;
`;
