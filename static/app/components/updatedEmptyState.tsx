import {useEffect} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import waitingForEventImg from 'sentry-images/spot/waiting-for-event.svg';

import {LinkButton} from '@sentry/scraps/button';
import {Image} from '@sentry/scraps/image';
import {Container, Flex, Grid} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {GuidedSteps} from 'sentry/components/guidedSteps/guidedSteps';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {AuthTokenGeneratorProvider} from 'sentry/components/onboarding/gettingStartedDoc/authTokenGenerator';
import {ContentBlocksRenderer} from 'sentry/components/onboarding/gettingStartedDoc/contentBlocks/renderer';
import {OnboardingCopyMarkdownButton} from 'sentry/components/onboarding/gettingStartedDoc/onboardingCopyMarkdownButton';
import {
  StepIndexProvider,
  TabSelectionScope,
} from 'sentry/components/onboarding/gettingStartedDoc/selectedCodeTabContext';
import {StepTitles} from 'sentry/components/onboarding/gettingStartedDoc/step';
import type {
  DocsParams,
  OnboardingStep,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {useSourcePackageRegistries} from 'sentry/components/onboarding/gettingStartedDoc/useSourcePackageRegistries';
import {useLoadGettingStarted} from 'sentry/components/onboarding/gettingStartedDoc/utils/useLoadGettingStarted';
import {allPlatforms as platforms} from 'sentry/data/platforms';
import {t, tct} from 'sentry/locale';
import {ConfigStore} from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {pulsingIndicatorStyles} from 'sentry/styles/pulsingIndicator';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {decodeInteger} from 'sentry/utils/queryString';
import {useApi} from 'sentry/utils/useApi';
import {useEventWaiter} from 'sentry/utils/useEventWaiter';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';

export function SetupTitle({project}: {project: Project}) {
  return (
    <BodyTitle>
      {tct('Set up the Sentry SDK for [projectBadge]', {
        projectBadge: (
          <Flex as="span" display="inline-flex" maxWidth="100%">
            <ProjectBadge project={project} avatarSize={16} />
          </Flex>
        ),
      })}
    </BodyTitle>
  );
}

function WaitingIndicator({project}: {project: Project}) {
  const organization = useOrganization();
  const firstIssue = useEventWaiter({
    eventType: 'error',
    organization,
    project,
  });

  if (!firstIssue) {
    return <EventWaitingIndicator />;
  }

  return (
    <LinkButton
      onClick={() =>
        trackAnalytics('growth.onboarding_take_to_error', {
          organization,
          platform: project.platform,
        })
      }
      to={`/organizations/${organization.slug}/issues/${
        firstIssue !== true && 'id' in firstIssue ? `${firstIssue.id}/` : ''
      }?referrer=onboarding-first-event-indicator`}
      variant="primary"
    >
      {t('Take me to my error')}
    </LinkButton>
  );
}

export default function UpdatedEmptyState({project}: {project?: Project}) {
  const theme = useTheme();
  const api = useApi();
  const organization = useOrganization();
  const location = useLocation();
  const navigate = useNavigate();

  const {isPending: isLoadingRegistry, data: registryData} =
    useSourcePackageRegistries(organization);

  const {isSelfHosted, urlPrefix} = useLegacyStore(ConfigStore);

  const currentPlatformKey = project?.platform ?? 'other';
  const currentPlatform = platforms.find(p => p.id === currentPlatformKey)!;

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
      <TabSelectionScope>
        <div>
          <Container radius="md" padding="3xl">
            <Text as="div" bold variant="inherit" style={{fontSize: '26px'}}>
              {t('Get Started with Sentry Issues')}
            </Text>
            <Container maxWidth="340px">
              {t('Your code sleuth eagerly awaits its first mission.')}
            </Container>
            <Container
              position="absolute"
              top="0px"
              right="20px"
              height="120px"
              overflow="hidden"
              pointerEvents="none"
              display={{zero: 'none', xl: 'block'}}
            >
              <Image
                src={waitingForEventImg}
                alt={t('A detective waits for the first issue to arrive')}
                height="120px"
                width="auto"
                loading="eager"
              />
            </Container>
          </Container>
          <Container
            as="hr"
            height="0px"
            width="95%"
            border="none"
            borderTop="primary"
            marginTop="0"
            marginBottom="0"
          />
          <Grid columns={{zero: 'minmax(0, 1fr)', xl: 'repeat(2, minmax(0, 1fr))'}}>
            <Container padding="3xl">
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
                  const isLastStep = index === steps.length - 1;
                  return (
                    <GuidedSteps.Step
                      key={index}
                      stepKey={title}
                      title={title}
                      trailingItems={
                        index === 0 ? (
                          <OnboardingCopyMarkdownButton
                            borderless
                            steps={steps}
                            source="issues_onboarding"
                          />
                        ) : undefined
                      }
                    >
                      <StepIndexProvider index={index}>
                        <ContentBlocksRenderer
                          contentBlocks={step.content}
                          spacing={theme.space.md}
                        />
                      </StepIndexProvider>
                      <GuidedSteps.ButtonWrapper>
                        <GuidedSteps.BackButton size="md" />
                        <GuidedSteps.NextButton size="md" />
                        {isLastStep && <WaitingIndicator project={project} />}
                      </GuidedSteps.ButtonWrapper>
                    </GuidedSteps.Step>
                  );
                })}
              </GuidedSteps>
              <Container
                position="absolute"
                right="50%"
                top="19%"
                height="78%"
                borderRight="primary"
                display={{zero: 'none', xl: 'block'}}
              />
            </Container>
            <Container padding="0 3xl" display={{zero: 'block', xl: 'none'}}>
              <Container as="hr" border="none" borderTop="primary" margin="0" />
            </Container>
            <Container padding="3xl">
              <BodyTitle>{t('Preview a Sentry Issue')}</BodyTitle>
              <Container marginTop="md" width="720px" maxWidth="100%">
                <iframe
                  src="https://demo.arcade.software/bQko6ZTRFMyTm6fJaDzs?embed"
                  loading="lazy"
                  allowFullScreen
                  title={t('Sentry issue preview')}
                  width="100%"
                  height={420}
                  style={{border: 0, colorScheme: 'auto'}}
                />
              </Container>
            </Container>
          </Grid>
        </div>
      </TabSelectionScope>
    </AuthTokenGeneratorProvider>
  );
}

function EventWaitingIndicator() {
  return (
    <Flex
      align="center"
      position="relative"
      padding="0 md"
      paddingRight="3xl"
      gap="md"
      flexGrow={1}
      style={{zIndex: 10}}
    >
      <Text size="md" variant="promotion">
        {t("Waiting for this project's first error")}
      </Text>
      <PulsingIndicator flexShrink={0} />
    </Flex>
  );
}

export function BodyTitle({children}: {children: React.ReactNode}) {
  return (
    <Container marginBottom="md">
      <Text as="div" size="xl" bold variant="inherit">
        {children}
      </Text>
    </Container>
  );
}

const PulsingIndicator = styled(Container)`
  ${pulsingIndicatorStyles}
`;
