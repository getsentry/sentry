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
import {Button, LinkButton} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {GuidedSteps} from 'sentry/components/guidedSteps/guidedSteps';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import type {TourStep} from 'sentry/components/modals/featureTourModal';
import FeatureTourModal, {
  TourImage,
  TourText,
} from 'sentry/components/modals/featureTourModal';
import {AuthTokenGeneratorProvider} from 'sentry/components/onboarding/gettingStartedDoc/authTokenGenerator';
import {OnboardingCodeSnippet} from 'sentry/components/onboarding/gettingStartedDoc/onboardingCodeSnippet';
import {
  type Configuration,
  TabbedCodeSnippet,
} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {
  type DocsParams,
  ProductSolution,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {useLoadGettingStarted} from 'sentry/components/onboarding/gettingStartedDoc/utils/useLoadGettingStarted';
import OnboardingPanel from 'sentry/components/onboardingPanel';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import {filterProjects} from 'sentry/components/performanceOnboarding/utils';
import {SidebarPanelKey} from 'sentry/components/sidebar/types';
import {
  withoutPerformanceSupport,
  withPerformanceOnboarding,
} from 'sentry/data/platformCategories';
import platforms, {otherPlatform} from 'sentry/data/platforms';
import {t, tct} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import SidebarPanelStore from 'sentry/stores/sidebarPanelStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import pulsingIndicatorStyles from 'sentry/styles/pulsingIndicator';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {browserHistory} from 'sentry/utils/browserHistory';
import {generateLinkToEventInTraceView} from 'sentry/utils/discover/urls';
import EventWaiter from 'sentry/utils/eventWaiter';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import useProjects from 'sentry/utils/useProjects';

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
              projectSlug: project.slug,
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

  const showOnboardingChecklist = organization.features.includes(
    'performance-onboarding-checklist'
  );

  useEffect(() => {
    if (
      showOnboardingChecklist &&
      location.hash === '#performance-sidequest' &&
      projectsForOnboarding.some(p => p.id === project.id)
    ) {
      SidebarPanelStore.activatePanel(SidebarPanelKey.PERFORMANCE_ONBOARDING);
    }
  }, [location.hash, projectsForOnboarding, project.id, showOnboardingChecklist]);

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

  if (hasPerformanceOnboarding && showOnboardingChecklist) {
    setupButton = (
      <Button
        priority="primary"
        onClick={event => {
          event.preventDefault();
          window.location.hash = 'performance-sidequest';
          SidebarPanelStore.activatePanel(SidebarPanelKey.PERFORMANCE_ONBOARDING);
        }}
      >
        {t('Set Up Tracing')}
      </Button>
    );
  }

  return (
    <Fragment>
      {noPerformanceSupport && (
        <UnsupportedAlert projectSlug={project.slug} featureName="Performance" />
      )}
      <OnboardingPanel image={<PerfImage src={emptyStateImg} />}>
        <h3>{t('Pinpoint problems')}</h3>
        <p>
          {t(
            'Something seem slow? Track down transactions to connect the dots between 10-second page loads and poor-performing API calls or slow database queries.'
          )}
        </p>
        <ButtonList gap={1}>
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
      </OnboardingPanel>
    </Fragment>
  );
}

const PerfImage = styled('img')`
  @media (min-width: ${p => p.theme.breakpoints.small}) {
    max-width: unset;
    user-select: none;
    position: absolute;
    top: 75px;
    bottom: 0;
    width: 450px;
    margin-top: auto;
    margin-bottom: auto;
  }

  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    width: 480px;
  }

  @media (min-width: ${p => p.theme.breakpoints.large}) {
    width: 600px;
  }
`;

const ButtonList = styled(ButtonBar)`
  grid-template-columns: repeat(auto-fit, minmax(130px, max-content));
  margin-bottom: 16px;
`;

function WaitingIndicator({
  api,
  organization,
  project,
}: {
  api: Client;
  organization: Organization;
  project: Project;
}) {
  const [received, setReceived] = useState<boolean>(false);

  return (
    <EventWaiter
      api={api}
      organization={organization}
      project={project}
      eventType="transaction"
      onIssueReceived={() => {
        setReceived(true);
      }}
    >
      {() => (received ? <EventReceivedIndicator /> : <EventWaitingIndicator />)}
    </EventWaiter>
  );
}

type ConfigurationStepProps = {
  api: Client;
  configuration: Configuration;
  organization: Organization;
  project: Project;
  showWaitingIndicator: boolean;
  stepKey: string;
  title: React.ReactNode;
};

function ConfigurationStep({
  stepKey,
  title,
  api,
  organization,
  project,
  configuration,
  showWaitingIndicator,
}: ConfigurationStepProps) {
  return (
    <GuidedSteps.Step stepKey={stepKey} title={title}>
      <div>
        <div>
          <DescriptionWrapper>{configuration.description}</DescriptionWrapper>
          <CodeSnippetWrapper>
            {configuration.code ? (
              Array.isArray(configuration.code) ? (
                <TabbedCodeSnippet tabs={configuration.code} />
              ) : (
                <OnboardingCodeSnippet language={configuration.language}>
                  {configuration.code}
                </OnboardingCodeSnippet>
              )
            ) : null}
          </CodeSnippetWrapper>
          <CodeSnippetWrapper>
            {configuration.configurations && configuration.configurations.length > 0 ? (
              Array.isArray(configuration.configurations[0]!.code) ? (
                <TabbedCodeSnippet tabs={configuration.configurations[0]!.code} />
              ) : null
            ) : null}
          </CodeSnippetWrapper>
          <DescriptionWrapper>{configuration.additionalInfo}</DescriptionWrapper>
          {showWaitingIndicator ? (
            <WaitingIndicator api={api} organization={organization} project={project} />
          ) : null}
        </div>
        <GuidedSteps.ButtonWrapper>
          <GuidedSteps.BackButton size="md" />
          <GuidedSteps.NextButton size="md" />
        </GuidedSteps.ButtonWrapper>
      </div>
    </GuidedSteps.Step>
  );
}

export function Onboarding({organization, project}: OnboardingProps) {
  const api = useApi();
  const {isSelfHosted, urlPrefix} = useLegacyStore(ConfigStore);
  const [received, setReceived] = useState<boolean>(false);
  const showNewUi = organization.features.includes('tracing-onboarding-new-ui');

  const currentPlatform = project.platform
    ? platforms.find(p => p.id === project.platform)
    : undefined;

  const {isLoading, docs, dsn, projectKeyId} = useLoadGettingStarted({
    platform: currentPlatform || otherPlatform,
    orgSlug: organization.slug,
    projSlug: project.slug,
    productType: 'performance',
  });

  if (!showNewUi) {
    return <LegacyOnboarding organization={organization} project={project} />;
  }

  const performanceDocs = docs?.performanceOnboarding;

  if (isLoading) {
    return <LoadingIndicator />;
  }

  const doesNotSupportPerformance = project.platform
    ? withoutPerformanceSupport.has(project.platform)
    : false;

  if (doesNotSupportPerformance) {
    return (
      <Fragment>
        <div>
          {tct(
            'Fiddlesticks. Performance isn’t available for your [platform] project yet but we’re definitely still working on it. Stay tuned.',
            {platform: currentPlatform?.name || project.slug}
          )}
        </div>
        <div>
          <LinkButton size="sm" href="https://docs.sentry.io/platforms/" external>
            {t('Go to Sentry Documentation')}
          </LinkButton>
        </div>
      </Fragment>
    );
  }

  if (!currentPlatform || !performanceDocs || !dsn || !projectKeyId) {
    return (
      <Fragment>
        <div>
          {tct(
            'Fiddlesticks. This checklist isn’t available for your [project] project yet, but for now, go to Sentry docs for installation details.',
            {project: project.slug}
          )}
        </div>
        <div>
          <LinkButton
            size="sm"
            href="https://docs.sentry.io/product/performance/getting-started/"
            external
          >
            {t('Go to documentation')}
          </LinkButton>
        </div>
      </Fragment>
    );
  }

  const docParams: DocsParams<any> = {
    api,
    projectKeyId,
    dsn,
    organization,
    platformKey: project.platform || 'other',
    projectId: project.id,
    projectSlug: project.slug,
    isFeedbackSelected: false,
    isPerformanceSelected: true,
    isProfilingSelected: false,
    isReplaySelected: false,
    sourcePackageRegistries: {
      isLoading: false,
      data: undefined,
    },
    platformOptions: [ProductSolution.PERFORMANCE_MONITORING],
    newOrg: false,
    feedbackOptions: {},
    urlPrefix,
    isSelfHosted,
  };

  const installStep = performanceDocs.install(docParams)[0]!;

  const configureStep = performanceDocs.configure(docParams)[0]!;
  const [sentryConfiguration, addingDistributedTracing] = configureStep.configurations!;

  const verifyStep = performanceDocs.verify(docParams)[0]!;
  const hasVerifyStep = !!(verifyStep.configurations || verifyStep.description);

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
      {() => (received ? <EventReceivedIndicator /> : <EventWaitingIndicator />)}
    </EventWaiter>
  );

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
              <Setup>
                <BodyTitle>{t('Set up the Sentry SDK')}</BodyTitle>
                <GuidedSteps>
                  <GuidedSteps.Step stepKey="install-sentry" title={t('Install Sentry')}>
                    <div>
                      <div>
                        <DescriptionWrapper>{installStep.description}</DescriptionWrapper>
                        {installStep.configurations?.map((configuration, index) => (
                          <div key={index}>
                            <DescriptionWrapper>
                              {configuration.description}
                            </DescriptionWrapper>
                            <CodeSnippetWrapper>
                              {configuration.code ? (
                                Array.isArray(configuration.code) ? (
                                  <TabbedCodeSnippet tabs={configuration.code} />
                                ) : (
                                  <OnboardingCodeSnippet
                                    language={configuration.language}
                                  >
                                    {configuration.code}
                                  </OnboardingCodeSnippet>
                                )
                              ) : null}
                            </CodeSnippetWrapper>
                          </div>
                        ))}
                        {!configureStep.configurations && !verifyStep.configurations
                          ? eventWaitingIndicator
                          : null}
                      </div>
                      <GuidedSteps.ButtonWrapper>
                        <GuidedSteps.BackButton size="md" />
                        <GuidedSteps.NextButton size="md" />
                      </GuidedSteps.ButtonWrapper>
                    </div>
                  </GuidedSteps.Step>
                  {sentryConfiguration ? (
                    <ConfigurationStep
                      stepKey={'configure-sentry'}
                      title={t('Configure Sentry')}
                      configuration={sentryConfiguration}
                      api={api}
                      organization={organization}
                      project={project}
                      showWaitingIndicator={!hasVerifyStep}
                    />
                  ) : null}
                  {addingDistributedTracing ? (
                    <ConfigurationStep
                      stepKey={'add-distributed-tracing'}
                      title={tct('Add Distributed Tracing [optional:(Optional)]', {
                        optional: <OptionalText />,
                      })}
                      configuration={addingDistributedTracing}
                      api={api}
                      organization={organization}
                      project={project}
                      showWaitingIndicator={!hasVerifyStep}
                    />
                  ) : null}
                  {verifyStep.configurations || verifyStep.description ? (
                    <GuidedSteps.Step stepKey="verify-sentry" title={t('Verify')}>
                      <div>
                        <DescriptionWrapper>{verifyStep.description}</DescriptionWrapper>
                        {verifyStep.configurations?.map((configuration, index) => (
                          <div key={index}>
                            <DescriptionWrapper>
                              {configuration.description}
                            </DescriptionWrapper>
                            <CodeSnippetWrapper>
                              {configuration.code ? (
                                Array.isArray(configuration.code) ? (
                                  <TabbedCodeSnippet tabs={configuration.code} />
                                ) : (
                                  <OnboardingCodeSnippet
                                    language={configuration.language}
                                  >
                                    {configuration.code}
                                  </OnboardingCodeSnippet>
                                )
                              ) : null}
                            </CodeSnippetWrapper>
                          </div>
                        ))}
                        {eventWaitingIndicator}
                      </div>
                      <GuidedSteps.ButtonWrapper>
                        <GuidedSteps.BackButton size="md" />
                        <SampleButton
                          triggerText={t('Take me to an example')}
                          loadingMessage={t('Processing sample trace...')}
                          errorMessage={t('Failed to create sample trace')}
                          organization={organization}
                          project={project}
                          api={api}
                        />
                      </GuidedSteps.ButtonWrapper>
                    </GuidedSteps.Step>
                  ) : (
                    <Fragment />
                  )}
                </GuidedSteps>
              </Setup>
              <Preview>
                <BodyTitle>{t('Preview a Sentry Trace')}</BodyTitle>
                <Arcade
                  src="https://demo.arcade.software/54VidzNthU5ykIFPCdW1?embed"
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
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.theme.pink400};
`;

const PulsingIndicator = styled('div')`
  ${pulsingIndicatorStyles};
  margin-left: ${space(1)};
`;

const OptionalText = styled('span')`
  color: ${p => p.theme.purple300};
  font-weight: ${p => p.theme.fontWeightNormal};
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
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.theme.successText};
`;

const SubTitle = styled('div')`
  margin-bottom: ${space(1)};
`;

const Title = styled('div')`
  font-size: 26px;
  font-weight: ${p => p.theme.fontWeightBold};
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

  @media (max-width: ${p => p.theme.breakpoints.small}) {
    flex: 1;
  }
`;

const BodyTitle = styled('div')`
  font-size: ${p => p.theme.fontSizeExtraLarge};
  font-weight: ${p => p.theme.fontWeightBold};
  margin-bottom: ${space(1)};
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

  @media (max-width: ${p => p.theme.breakpoints.small}) {
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
  height: 500px;
  border: 0;
`;

const CodeSnippetWrapper = styled('div')`
  margin-bottom: ${space(2)};
`;

const DescriptionWrapper = styled('div')`
  margin-bottom: ${space(1)};

  code {
    color: ${p => p.theme.pink400};
  }
`;
