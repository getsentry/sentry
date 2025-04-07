import styled from '@emotion/styled';

import emptyTraceImg from 'sentry-images/spot/profiling-empty-state.svg';

import {LinkButton} from 'sentry/components/core/button';
import {GuidedSteps} from 'sentry/components/guidedSteps/guidedSteps';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {AuthTokenGeneratorProvider} from 'sentry/components/onboarding/gettingStartedDoc/authTokenGenerator';
import {OnboardingCodeSnippet} from 'sentry/components/onboarding/gettingStartedDoc/onboardingCodeSnippet';
import {
  type Configuration,
  type StepProps,
  StepTitles,
  StepType,
  TabbedCodeSnippet,
} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {
  DocsPageLocation,
  type DocsParams,
  ProductSolution,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {useLoadGettingStarted} from 'sentry/components/onboarding/gettingStartedDoc/utils/useLoadGettingStarted';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import {profiling as profilingPlatforms} from 'sentry/data/platformCategories';
import platforms, {otherPlatform} from 'sentry/data/platforms';
import {t, tct} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import pulsingIndicatorStyles from 'sentry/styles/pulsingIndicator';
import {space} from 'sentry/styles/space';
import type {Project} from 'sentry/types/project';
import EventWaiter from 'sentry/utils/eventWaiter';
import {useProfileEvents} from 'sentry/utils/profiling/hooks/useProfileEvents';
import {generateProfileFlamechartRoute} from 'sentry/utils/profiling/routes';
import {getSelectedProjectList} from 'sentry/utils/project/useSelectedProjectsHaveField';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';

function useOnboardingProject() {
  const {projects} = useProjects();
  const pageFilters = usePageFilters();
  const selectedProject = getSelectedProjectList(
    pageFilters.selection.projects,
    projects
  );
  return selectedProject[0];
}

function WaitingIndicator({
  project,
  hasProfile,
}: {
  hasProfile: boolean;
  project: Project;
}) {
  const organization = useOrganization();

  const {data} = useProfileEvents({
    fields: ['profile.id', 'timestamp'],
    limit: 1,
    referrer: 'profiling-onboarding',
    sort: {
      key: 'timestamp',
      order: 'desc',
    },
    enabled: hasProfile,
  });

  const profileId = data?.data[0]?.['profile.id']?.toString();

  return profileId ? (
    <LinkButton
      priority="primary"
      to={generateProfileFlamechartRoute({
        organization,
        projectSlug: project.slug,
        profileId,
      })}
    >
      {t('Take me to my profile')}
    </LinkButton>
  ) : (
    <EventWaitingIndicator />
  );
}

function ConfigurationRenderer({configuration}: {configuration: Configuration}) {
  const subConfigurations = configuration.configurations ?? [];
  return (
    <ConfigurationWrapper>
      {configuration.description && (
        <DescriptionWrapper>{configuration.description}</DescriptionWrapper>
      )}
      {configuration.code ? (
        Array.isArray(configuration.code) ? (
          <TabbedCodeSnippet tabs={configuration.code} />
        ) : (
          <OnboardingCodeSnippet language={configuration.language}>
            {configuration.code}
          </OnboardingCodeSnippet>
        )
      ) : null}
      {subConfigurations.map((subConfiguration, index) => (
        <ConfigurationRenderer key={index} configuration={subConfiguration} />
      ))}
      {configuration.additionalInfo && (
        <AdditionalInfo>{configuration.additionalInfo}</AdditionalInfo>
      )}
    </ConfigurationWrapper>
  );
}

function StepRenderer({
  project,
  step,
  isLastStep,
}: {
  isLastStep: boolean;
  project: Project;
  step: StepProps;
}) {
  const {type, title} = step;
  const api = useApi();
  const organization = useOrganization();

  return (
    <GuidedSteps.Step stepKey={type || title} title={title || (type && StepTitles[type])}>
      <ConfigurationRenderer configuration={step} />
      <GuidedSteps.ButtonWrapper>
        <GuidedSteps.BackButton size="md" />
        <GuidedSteps.NextButton size="md" />
        {isLastStep && (
          <EventWaiter
            api={api}
            organization={organization}
            project={project}
            eventType="profile"
          >
            {({firstIssue}) => (
              <WaitingIndicator project={project} hasProfile={!!firstIssue} />
            )}
          </EventWaiter>
        )}
      </GuidedSteps.ButtonWrapper>
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
                <Title>{t('Find Slow Code')}</Title>
                <SubTitle>
                  {t(
                    'Use aggregated profiling data to find the slowest code paths in your app and to identify functions that have regressed in performance.'
                  )}
                </SubTitle>
                <BulletList>
                  <li>
                    {t(
                      'Find and optimize resource-intensive code paths that cause excessive infrastructure cost for running your backend services'
                    )}
                  </li>
                  <li>
                    {t(
                      'Debug unresponsive interactions and janky scrolling in your mobile and browser apps'
                    )}
                  </li>
                  <li>
                    {t(
                      'Augment traces & spans with function-level visibility into the code that is causing increased latency'
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
                <BodyTitle>{t('Preview a Sentry Profile')}</BodyTitle>
                <Arcade
                  src="https://demo.arcade.software/BSKubAMPPaF4N5hujNbi?embed"
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

  const doesSupportProfiling = currentPlatform
    ? profilingPlatforms.includes(currentPlatform.id)
    : false;

  const profilingDocs = docs?.profilingOnboarding;

  if (!project) {
    return <div>{t('No project found')}</div>;
  }

  if (isLoading) {
    return <LoadingIndicator />;
  }

  if (!currentPlatform || !doesSupportProfiling) {
    return (
      <OnboardingPanel project={project}>
        <DescriptionWrapper>
          <p>
            {tct(
              'Fiddlesticks. Profiling isn’t available for your [platform] project yet but we’re definitely still working on it. Stay tuned.',
              {platform: currentPlatform?.name || project.slug}
            )}
          </p>
          <LinkButton size="sm" href="https://docs.sentry.io/product/profiling/" external>
            {t('Go to Documentation')}
          </LinkButton>
        </DescriptionWrapper>
      </OnboardingPanel>
    );
  }

  if (!profilingDocs || !dsn || !projectKeyId) {
    return (
      <OnboardingPanel project={project}>
        <DescriptionWrapper>
          <p>
            {tct(
              'Fiddlesticks. The profiling onboarding checklist isn’t available for your [project] project yet, but for now, go to Sentry docs for installation details.',
              {project: project.slug}
            )}
          </p>
          <LinkButton
            size="sm"
            href={
              // TODO(aknaus): Go does not have profiling docs yet, so we redirect to the general profiling docs. Remove this once Go has docs.
              currentPlatform.id === 'go'
                ? 'https://docs.sentry.io/product/profiling/getting-started/'
                : `${currentPlatform.link}/profiling/`
            }
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
    projectId: project.id,
    projectSlug: project.slug,
    isFeedbackSelected: false,
    isPerformanceSelected: true,
    isProfilingSelected: true,
    isReplaySelected: false,
    sourcePackageRegistries: {
      isLoading: false,
      data: undefined,
    },
    platformOptions: [ProductSolution.PERFORMANCE_MONITORING, ProductSolution.PROFILING],
    docsLocation: DocsPageLocation.PROFILING_PAGE,
    profilingOptions: {
      defaultProfilingMode: organization.features.includes('continuous-profiling')
        ? 'continuous'
        : 'transaction',
    },
    newOrg: false,
    urlPrefix,
    isSelfHosted,
  };

  const introduction = profilingDocs.introduction?.(docParams);

  const steps = [
    ...profilingDocs.install(docParams),
    ...profilingDocs.configure(docParams),
    // TODO(aknaus): Move into snippets once all have profiling docs
    {
      type: StepType.VERIFY,
      description: t(
        'Verify that profiling is working correctly by simply using your application.'
      ),
    },
  ];

  return (
    <OnboardingPanel project={project}>
      <BodyTitle>{t('Set up the Sentry SDK')}</BodyTitle>
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
    {t("Waiting for this project's first profile")}
    <PulsingIndicator />
  </div>
))`
  display: flex;
  align-items: center;
  position: relative;
  padding: 0 ${space(1)};
  z-index: 10;
  flex-grow: 1;
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.theme.pink400};
`;

const PulsingIndicator = styled('div')`
  ${pulsingIndicatorStyles};
  margin-left: ${space(1)};
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
  margin-top: ${space(3)};
  height: 522px;
  border: 0;
`;

const CONTENT_SPACING = space(1);

const ConfigurationWrapper = styled('div')`
  margin-bottom: ${CONTENT_SPACING};
`;

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
    font-size: ${p => p.theme.fontSizeExtraLarge};
    font-weight: ${p => p.theme.fontWeightBold};
    line-height: 34px;
  }

  && > * {
    margin: 0;
    &:not(:last-child) {
      margin-bottom: ${CONTENT_SPACING};
    }
  }
`;

const AdditionalInfo = styled(DescriptionWrapper)`
  margin-top: ${CONTENT_SPACING};
`;
