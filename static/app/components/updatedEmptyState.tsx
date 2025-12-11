import {useEffect} from 'react';
import styled from '@emotion/styled';

import waitingForEventImg from 'sentry-images/spot/waiting-for-event.svg';

import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {GuidedSteps} from 'sentry/components/guidedSteps/guidedSteps';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {AuthTokenGeneratorProvider} from 'sentry/components/onboarding/gettingStartedDoc/authTokenGenerator';
import {ContentBlocksRenderer} from 'sentry/components/onboarding/gettingStartedDoc/contentBlocks/renderer';
import {StepTitles} from 'sentry/components/onboarding/gettingStartedDoc/step';
import type {
  DocsParams,
  OnboardingStep,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {useSourcePackageRegistries} from 'sentry/components/onboarding/gettingStartedDoc/useSourcePackageRegistries';
import {useLoadGettingStarted} from 'sentry/components/onboarding/gettingStartedDoc/utils/useLoadGettingStarted';
import platforms from 'sentry/data/platforms';
import {t, tct} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {space} from 'sentry/styles/space';
import type {PlatformIntegration, Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {decodeInteger} from 'sentry/utils/queryString';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import FirstEventIndicator from 'sentry/views/onboarding/components/firstEventIndicator';

export function SetupTitle({project}: {project: Project}) {
  return (
    <BodyTitle>
      {tct('Set up the Sentry SDK for [projectBadge]', {
        projectBadge: (
          <ProjectBadgeWrapper>
            <ProjectBadge project={project} avatarSize={16} />
          </ProjectBadgeWrapper>
        ),
      })}
    </BodyTitle>
  );
}

export default function UpdatedEmptyState({project}: {project?: Project}) {
  const api = useApi();
  const organization = useOrganization();
  const location = useLocation();
  const navigate = useNavigate();

  const {isPending: isLoadingRegistry, data: registryData} =
    useSourcePackageRegistries(organization);

  const {isSelfHosted, urlPrefix} = useLegacyStore(ConfigStore);

  const currentPlatformKey = project?.platform ?? 'other';
  const currentPlatform = platforms.find(
    p => p.id === currentPlatformKey
  ) as PlatformIntegration;

  useEffect(() => {
    trackAnalytics('issue_stream.updated_empty_state_viewed', {
      organization,
      platform: currentPlatformKey,
    });
  }, [organization, currentPlatformKey]);

  const loadGettingStarted = useLoadGettingStarted({
    platform: currentPlatform,
    orgSlug: organization.slug,
    projSlug: project?.slug,
  });

  if (
    !currentPlatform ||
    !project ||
    loadGettingStarted.isError ||
    loadGettingStarted.isLoading ||
    !loadGettingStarted.docs ||
    !loadGettingStarted.dsn ||
    !loadGettingStarted.projectKeyId
  ) {
    return null;
  }

  const docParams: DocsParams<any> = {
    api,
    projectKeyId: loadGettingStarted.projectKeyId,
    dsn: loadGettingStarted.dsn,
    organization,
    platformKey: currentPlatformKey,
    project,
    isLogsSelected: false,
    isMetricsSelected: false,
    isFeedbackSelected: false,
    isPerformanceSelected: false,
    isProfilingSelected: false,
    isReplaySelected: false,
    sourcePackageRegistries: {
      isLoading: isLoadingRegistry,
      data: registryData,
    },
    platformOptions: {installationMode: 'auto'},
    newOrg: false,
    replayOptions: {block: true, mask: true},
    isSelfHosted,
    urlPrefix,
  };

  if (currentPlatformKey === 'java' || currentPlatformKey === 'java-spring-boot') {
    docParams.platformOptions = {
      ...docParams.platformOptions,
      packageManager: 'gradle',
    };
  }

  if (currentPlatformKey === 'javascript') {
    docParams.platformOptions = {
      ...docParams.platformOptions,
      installationMode: 'manual',
    };
  }

  const install = loadGettingStarted.docs.onboarding.install(docParams);
  const configure = loadGettingStarted.docs.onboarding.configure(docParams);
  const verify = loadGettingStarted.docs.onboarding.verify(docParams);

  // TODO: Is there a reason why we are only selecting a few steps?
  const steps = [install[0], configure[0], configure[1], verify[0]]
    // Filter optional steps
    .filter((step): step is OnboardingStep => !!step && !step.collapsible);

  return (
    <AuthTokenGeneratorProvider projectSlug={project?.slug}>
      <div>
        <HeaderWrapper>
          <Title>{t('Get Started with Sentry Issues')}</Title>
          <Description>
            {t('Your code sleuth eagerly awaits its first mission.')}
          </Description>
          <Image src={waitingForEventImg} />
        </HeaderWrapper>
        <Divider />
        <Body>
          <Setup>
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
                const title = step.title ?? StepTitles[step.type ?? 'install'];
                return (
                  <GuidedSteps.Step key={index} stepKey={title} title={title}>
                    <ContentBlocksRenderer
                      contentBlocks={step.content}
                      spacing={space(1)}
                    />
                    {index === steps.length - 1 ? (
                      <FirstEventIndicator
                        organization={organization}
                        project={project}
                        eventType="error"
                      >
                        {({indicator, firstEventButton}) => (
                          <FirstEventWrapper>
                            <IndicatorWrapper>{indicator}</IndicatorWrapper>
                            <StyledButtonBar>
                              <GuidedSteps.BackButton size="md" />
                              {firstEventButton}
                            </StyledButtonBar>
                          </FirstEventWrapper>
                        )}
                      </FirstEventIndicator>
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
          </Setup>
          <Preview>
            <BodyTitle>{t('Preview a Sentry Issue')}</BodyTitle>
            <ArcadeWrapper>
              <Arcade
                src="https://demo.arcade.software/bQko6ZTRFMyTm6fJaDzs?embed"
                loading="lazy"
                allowFullScreen
              />
            </ArcadeWrapper>
          </Preview>
        </Body>
      </div>
    </AuthTokenGeneratorProvider>
  );
}

const ProjectBadgeWrapper = styled('div')`
  display: inline-block;
  vertical-align: text-top;
  max-width: 100%;
`;

const Title = styled('div')`
  font-size: 26px;
  font-weight: ${p => p.theme.fontWeight.bold};
`;

const Description = styled('div')`
  max-width: 340px;
`;

const ArcadeWrapper = styled('div')`
  margin-top: ${space(1)};
`;

const HeaderWrapper = styled('div')`
  border-radius: ${p => p.theme.radius.md};
  padding: ${space(4)};
`;

const Setup = styled('div')`
  padding: ${space(4)};

  &:after {
    content: '';
    position: absolute;
    right: 50%;
    top: 19%;
    height: 78%;
    border-right: 1px ${p => p.theme.border} solid;
  }
`;

export const BodyTitle = styled('div')`
  font-size: ${p => p.theme.fontSize.xl};
  font-weight: ${p => p.theme.fontWeight.bold};
  margin-bottom: ${space(1)};
`;

const Preview = styled('div')`
  padding: ${space(4)};
`;

const Body = styled('div')`
  display: grid;
  grid-auto-columns: minmax(0, 1fr);
  grid-auto-flow: column;

  h4 {
    margin-bottom: 0;
  }
`;

const Image = styled('img')`
  position: absolute;
  display: block;
  top: 0px;
  right: 20px;
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
  width: 720px;
  max-width: 100%;
  height: 420px;
  border: 0;
  color-scheme: auto;
`;

const StyledButtonBar = styled(ButtonBar)`
  display: flex;
`;

const IndicatorWrapper = styled('div')`
  width: 300px;
  max-width: 100%;
  margin-bottom: ${space(1)};
`;

const FirstEventWrapper = styled('div')`
  padding-top: ${space(1)};
`;
