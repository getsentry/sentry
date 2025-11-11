import {useEffect, useState} from 'react';
import styled from '@emotion/styled';

import emptyTraceImg from 'sentry-images/spot/profiling-empty-state.svg';

import {ExternalLink} from '@sentry/scraps/link';

import {Button} from 'sentry/components/core/button';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {GuidedSteps} from 'sentry/components/guidedSteps/guidedSteps';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {AuthTokenGeneratorProvider} from 'sentry/components/onboarding/gettingStartedDoc/authTokenGenerator';
import {ContentBlocksRenderer} from 'sentry/components/onboarding/gettingStartedDoc/contentBlocks/renderer';
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
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import {SetupTitle} from 'sentry/components/updatedEmptyState';
import {agentMonitoringPlatforms} from 'sentry/data/platformCategories';
import platforms, {otherPlatform} from 'sentry/data/platforms';
import {t, tct} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import pulsingIndicatorStyles from 'sentry/styles/pulsingIndicator';
import {space} from 'sentry/styles/space';
import type {PlatformKey, Project} from 'sentry/types/project';
import {getSelectedProjectList} from 'sentry/utils/project/useSelectedProjectsHaveField';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import {useSpans} from 'sentry/views/insights/common/queries/useDiscover';
import {Referrer} from 'sentry/views/insights/pages/agents/utils/referrers';

function useOnboardingProject() {
  const {projects} = useProjects();
  const pageFilters = usePageFilters();
  const selectedProject = getSelectedProjectList(
    pageFilters.selection.projects,
    projects
  );
  const agentMonitoringProjects = selectedProject.filter(p =>
    agentMonitoringPlatforms.has(p.platform as PlatformKey)
  );

  if (agentMonitoringProjects.length > 0) {
    return agentMonitoringProjects[0];
  }
  return selectedProject[0];
}

function useAiSpanWaiter(project: Project) {
  const {selection} = usePageFilters();
  const [shouldRefetch, setShouldRefetch] = useState(true);

  const request = useSpans(
    {
      search: 'span.op:"gen_ai.*"',
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
      setShouldRefetch(false);
    }
  }, [hasEvents, shouldRefetch]);

  return request;
}

function WaitingIndicator({project}: {project: Project}) {
  const spanRequest = useAiSpanWaiter(project);
  const {reloadProjects, fetching} = useProjects();
  const hasEvents = Boolean(spanRequest.data?.length);

  return hasEvents ? (
    <Button priority="primary" busy={fetching} onClick={reloadProjects}>
      {t('View Agent Monitoring')}
    </Button>
  ) : (
    <EventWaitingIndicator />
  );
}

function StepRenderer({
  project,
  step,
  isLastStep,
}: {
  isLastStep: boolean;
  project: Project;
  step: OnboardingStep;
}) {
  return (
    <GuidedSteps.Step
      stepKey={step.type || step.title}
      title={step.title || (step.type && StepTitles[step.type])}
    >
      <ContentBlocksRenderer spacing={space(1)} contentBlocks={step.content} />
      <GuidedSteps.ButtonWrapper>
        <GuidedSteps.BackButton size="md" />
        <GuidedSteps.NextButton size="md" />
        {isLastStep && <WaitingIndicator project={project} />}
      </GuidedSteps.ButtonWrapper>
      {/* This spacer ensures the whole pulse effect is visible, as the parent has overflow: hidden */}
      {isLastStep && <PulseSpacer />}
    </GuidedSteps.Step>
  );
}

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
                <Title>{t('Monitor AI Agents')}</Title>
                <SubTitle>
                  {t(
                    'Get comprehensive visibility into your AI agents and LLM applications to understand performance, costs, and user interactions.'
                  )}
                </SubTitle>
                <BulletList>
                  <li>
                    {t('Track token usage, costs, and latency across all your LLM calls')}
                  </li>
                  <li>
                    {t(
                      'Monitor agent conversations, tool usage, and decision-making processes'
                    )}
                  </li>
                  <li>
                    {t(
                      'Debug failed requests and optimize prompt performance with detailed traces'
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
                <BodyTitle>{t('Preview Agent Insights')}</BodyTitle>
                <Arcade
                  src="https://demo.arcade.software/0NzB6M1Wn8sDsFDAj4sE?embed"
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

export function Onboarding() {
  const api = useApi();
  const {isSelfHosted, urlPrefix} = useLegacyStore(ConfigStore);
  const project = useOnboardingProject();
  const organization = useOrganization();

  const currentPlatform = project?.platform
    ? platforms.find(p => p.id === project.platform)
    : undefined;

  const {isLoading, docs, dsn, projectKeyId} = useLoadGettingStarted({
    platform: currentPlatform || otherPlatform,
    orgSlug: organization.slug,
    projSlug: project?.slug,
  });

  // Local integration options for Agent Monitoring only
  const isPythonPlatform = (project?.platform ?? '').startsWith('python');
  const integrationOptions = {
    integration: {
      label: t('Integration'),
      items: isPythonPlatform
        ? [
            {label: 'OpenAI SDK', value: 'openai'},
            {label: 'OpenAI Agents SDK', value: 'openai_agents'},
            {label: 'Anthropic SDK', value: 'anthropic'},
            {label: 'Google Gen AI SDK', value: 'google_genai'},
            {label: 'LangChain', value: 'langchain'},
            {label: 'LangGraph', value: 'langgraph'},
            {label: 'LiteLLM', value: 'litellm'},
            {label: 'Pydantic AI', value: 'pydantic_ai'},
            {label: 'Manual', value: 'manual'},
          ]
        : [
            {label: 'Vercel AI SDK', value: 'vercel_ai'},
            {label: 'OpenAI SDK', value: 'openai'},
            {label: 'Anthropic SDK', value: 'anthropic'},
            {label: 'Google Gen AI SDK', value: 'google_genai'},
            {label: 'Manual', value: 'manual'},
          ],
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
      <OnboardingPanel project={project}>
        <DescriptionWrapper>
          <p>
            {tct(
              'Fiddlesticks. Auto instrumentation of AI Agents is not available for your [platform] project. ',
              {
                platform: currentPlatform?.name || project.slug,
              }
            )}
          </p>
          <p>
            {tct(
              'However, you can still manually instrument your agents using the Sentry SDK tracing API. See [link:custom instrumentation docs] for details.',
              {
                link: (
                  <ExternalLink href="https://docs.sentry.io/platforms/python/tracing/instrumentation/custom-instrumentation/ai-agents-module/" />
                ),
              }
            )}
          </p>
        </DescriptionWrapper>
      </OnboardingPanel>
    );
  }

  if (isLoading) {
    return <LoadingIndicator />;
  }

  const agentMonitoringDocs = docs?.agentMonitoringOnboarding;

  if (!agentMonitoringDocs || !dsn || !projectKeyId) {
    return (
      <OnboardingPanel project={project}>
        <DescriptionWrapper>
          <p>
            {tct(
              "The agent monitoring onboarding checklist isn't available for your [project] project yet, but you can still set up the Sentry SDK to start monitoring your AI agents.",
              {project: project.slug}
            )}
          </p>
          <LinkButton
            size="sm"
            href="https://docs.sentry.io/product/insights/ai/agents/"
            external
          >
            {t('Go to Documentation')}
          </LinkButton>
        </DescriptionWrapper>
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
    platformOptions: selectedPlatformOptions,
    docsLocation: DocsPageLocation.PROFILING_PAGE,
    newOrg: false,
    urlPrefix,
    isSelfHosted,
  };

  const introduction = agentMonitoringDocs.introduction?.(docParams);

  const steps = [
    ...(agentMonitoringDocs.install?.(docParams) || []),
    ...(agentMonitoringDocs.configure?.(docParams) || []),
    ...(agentMonitoringDocs.verify?.(docParams) || []),
  ];

  return (
    <OnboardingPanel project={project}>
      <SetupTitle project={project} />
      <OptionsWrapper>
        <PlatformOptionDropdown platformOptions={integrationOptions} />
      </OptionsWrapper>
      {introduction && <DescriptionWrapper>{introduction}</DescriptionWrapper>}
      <GuidedSteps>
        {steps
          // Only show non-optional steps
          .filter(step => !step.collapsible)
          .map((step, index) => (
            <StepRenderer
              key={index}
              project={project}
              step={step}
              isLastStep={index === steps.length - 1}
            />
          ))}
      </GuidedSteps>
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
  font-size: ${p => p.theme.fontSize.md};
  color: ${p => p.theme.pink400};
  padding-right: ${p => p.theme.space['3xl']};
`;

const PulseSpacer = styled('div')`
  height: ${p => p.theme.space['3xl']};
`;

const PulsingIndicator = styled('div')`
  ${pulsingIndicatorStyles};
  flex-shrink: 0;
`;

const SubTitle = styled('div')`
  margin-bottom: ${p => p.theme.space.md};
`;

const Title = styled('div')`
  font-size: 26px;
  font-weight: ${p => p.theme.fontWeight.bold};
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
  border-radius: ${p => p.theme.borderRadius};
  padding: ${p => p.theme.space['3xl']};
`;

const HeaderText = styled('div')`
  flex: 0.65;

  @media (max-width: ${p => p.theme.breakpoints.sm}) {
    flex: 1;
  }
`;

const BodyTitle = styled('div')`
  font-size: ${p => p.theme.fontSize.xl};
  font-weight: ${p => p.theme.fontWeight.bold};
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
    border-right: 1px ${p => p.theme.border} solid;
  }
`;

const Preview = styled('div')`
  padding: ${p => p.theme.space['3xl']};
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
  margin-top: ${p => p.theme.space['2xl']};
  height: 522px;
  border: 0;
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

const CONTENT_SPACING = space(1);

const DescriptionWrapper = styled('div')`
  code:not([class*='language-']) {
    color: ${p => p.theme.pink400};
  }

  :not(:last-child) {
    margin-bottom: ${CONTENT_SPACING};
  }

  && > h4,
  && > h5,
  && > h6 {
    font-size: ${p => p.theme.fontSize.xl};
    font-weight: ${p => p.theme.fontWeight.bold};
    line-height: 34px;
  }

  && > * {
    margin: 0;
    &:not(:last-child) {
      margin-bottom: ${CONTENT_SPACING};
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
