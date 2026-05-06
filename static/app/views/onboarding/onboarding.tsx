import {useCallback, useEffect, useState, type PropsWithChildren} from 'react';
import styled from '@emotion/styled';
import {AnimatePresence, motion} from 'framer-motion';

import {Button} from '@sentry/scraps/button';
import {Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';

import Hook from 'sentry/components/hook';
import {LogoSentry} from 'sentry/components/logoSentry';
import {
  OnboardingContextProvider,
  useOnboardingContext,
} from 'sentry/components/onboarding/onboardingContext';
import {useRecentCreatedProject} from 'sentry/components/onboarding/useRecentCreatedProject';
import {Redirect} from 'sentry/components/redirect';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {categoryList} from 'sentry/data/platformPickerCategories';
import {allPlatforms as platforms} from 'sentry/data/platforms';
import {IconArrow} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {OnboardingSelectedSDK} from 'sentry/types/onboarding';
import type {PlatformKey} from 'sentry/types/project';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useReplayForCriticalFlow} from 'sentry/utils/replays/useReplayForCriticalFlow';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useExperiment} from 'sentry/utils/useExperiment';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {PageCorners} from 'sentry/views/onboarding/components/pageCorners';
import {useBackActions} from 'sentry/views/onboarding/useBackActions';
import {useHasNewWelcomeUI} from 'sentry/views/onboarding/useHasNewWelcomeUI';
import {useOnboardingSidebar} from 'sentry/views/onboarding/useOnboardingSidebar';

import {NewWelcomeUI} from './components/newWelcome';
import {OnboardingSkipButton} from './components/onboardingSkipButton';
import {Stepper} from './components/stepper';
import {PlatformSelection} from './platformSelection';
import {ScmConnect} from './scmConnect';
import {ScmPlatformFeatures} from './scmPlatformFeatures';
import {ScmProjectDetails} from './scmProjectDetails';
import {SetupDocs} from './setupDocs';
import {OnboardingStepId, type StepDescriptor, type StepProps} from './types';
import {TargetedOnboardingWelcome} from './welcome';

const legacyOnboardingSteps: StepDescriptor[] = [
  {
    id: OnboardingStepId.WELCOME,
    title: t('Welcome'),
    Component: WelcomeVariable,
    cornerVariant: 'top-right',
  },
  {
    id: OnboardingStepId.SELECT_PLATFORM,
    title: t('Select platform'),
    Component: PlatformSelection,
    hasFooter: true,
    cornerVariant: 'top-left',
  },
  {
    id: OnboardingStepId.SETUP_DOCS,
    title: t('Install the Sentry SDK'),
    Component: SetupDocs,
    hasFooter: true,
    cornerVariant: 'top-left',
  },
];

const scmOnboardingSteps: StepDescriptor[] = [
  {
    id: OnboardingStepId.WELCOME,
    title: t('Welcome'),
    Component: WelcomeVariable,
    cornerVariant: 'top-right',
  },
  {
    id: OnboardingStepId.SCM_CONNECT,
    title: t('Connect repository'),
    Component: ScmConnect,
    cornerVariant: 'top-left',
  },
  {
    id: OnboardingStepId.SCM_PLATFORM_FEATURES,
    title: t('Create your first project'),
    Component: ScmPlatformFeatures,
    cornerVariant: 'top-left',
  },
  {
    id: OnboardingStepId.SCM_PROJECT_DETAILS,
    title: t('Project details'),
    Component: ScmProjectDetails,
    hasFooter: true,
    cornerVariant: 'top-left',
  },
  {
    id: OnboardingStepId.SETUP_DOCS,
    title: t('Install the Sentry SDK'),
    Component: SetupDocs,
    hasFooter: true,
    cornerVariant: 'top-left',
  },
];

function WelcomeVariable(props: StepProps) {
  const hasNewWelcomeUI = useHasNewWelcomeUI();

  if (hasNewWelcomeUI) return <NewWelcomeUI {...props} />;

  return <TargetedOnboardingWelcome {...props} />;
}

interface ContainerVariableProps {
  hasFooter: boolean;
  hasNewWelcomeUI: boolean;
  hasScmOnboarding: boolean;
  id: OnboardingStepId;
}

function ContainerVariable(props: PropsWithChildren<ContainerVariableProps>) {
  const newWelcomeUIStep = props.hasNewWelcomeUI && props.id === OnboardingStepId.WELCOME;

  if (newWelcomeUIStep && !props.hasScmOnboarding) {
    return (
      <OnboardingContainerNewWelcomeUI hasFooter>
        {props.children}
      </OnboardingContainerNewWelcomeUI>
    );
  }

  return (
    <OnboardingContainer
      hasFooter={props.hasFooter}
      hasScmOnboarding={props.hasScmOnboarding}
    >
      {props.children}
    </OnboardingContainer>
  );
}

interface OnboardingStepVariableProps {
  hasNewWelcomeUI: boolean;
  hasScmOnboarding: boolean;
  id: OnboardingStepId;
}

function OnboardingStepVariable(props: PropsWithChildren<OnboardingStepVariableProps>) {
  const Component =
    props.hasNewWelcomeUI &&
    props.id === OnboardingStepId.WELCOME &&
    !props.hasScmOnboarding
      ? OnboardingStepNewUi
      : OnboardingStep;

  return (
    <Component
      initial="initial"
      animate="animate"
      exit="exit"
      variants={{animate: {}}}
      transition={{
        staggerChildren: 0.2,
      }}
      data-test-id={`onboarding-step-${props.id}`}
    >
      {props.children}
    </Component>
  );
}

export function OnboardingWithoutContext() {
  const location = useLocation();
  const navigate = useNavigate();
  const {step: stepId} = useParams<{step: string}>();
  const organization = useOrganization();
  const onboardingContext = useOnboardingContext();
  const selectedProjectSlug =
    onboardingContext.createdProjectSlug ?? onboardingContext.selectedPlatform?.key;

  const hasNewWelcomeUI = useHasNewWelcomeUI();
  const {inExperiment: hasScmOnboarding} = useExperiment({
    feature: 'onboarding-scm-experiment',
    reportExposure: true,
  });

  // Only report exposure for users who are actually in SCM onboarding —
  // the assignment is irrelevant for legacy onboarding.
  const {inExperiment: hasProjectDetailsStep} = useExperiment({
    feature: 'onboarding-scm-project-details-experiment',
    reportExposure: hasScmOnboarding,
  });

  const scmSteps = hasProjectDetailsStep
    ? scmOnboardingSteps
    : scmOnboardingSteps.filter(s => s.id !== OnboardingStepId.SCM_PROJECT_DETAILS);

  const onboardingSteps = hasScmOnboarding ? scmSteps : legacyOnboardingSteps;

  useReplayForCriticalFlow({
    flowName: 'scm_onboarding',
    enabled: hasScmOnboarding,
    sampleRate: 0.3,
  });

  const stepObj = onboardingSteps.find(({id}) => stepId === id);
  const stepIndex = onboardingSteps.findIndex(({id}) => stepId === id);

  const projectSlug = stepObj?.id === 'setup-docs' ? selectedProjectSlug : undefined;

  const {project: recentCreatedProject, isProjectActive} = useRecentCreatedProject({
    orgSlug: organization.slug,
    projectSlug,
    // Wait until the first event is received as we have an UI element that depends on it
    pollUntilFirstEvent: true,
  });

  const {activateSidebar} = useOnboardingSidebar();

  useEffect(() => {
    if (
      normalizeUrl(location.pathname, {forceCustomerDomain: true}) ===
        `/onboarding/${OnboardingStepId.SETUP_DOCS}/` &&
      location.query?.platform &&
      onboardingContext.selectedPlatform === undefined
    ) {
      const platform = Object.values(platforms).find(
        p => p.id === location.query.platform
      );

      // if no platform found, redirect to the appropriate platform selection step
      if (!platform) {
        const fallbackStep = hasScmOnboarding
          ? OnboardingStepId.SCM_PLATFORM_FEATURES
          : OnboardingStepId.SELECT_PLATFORM;
        navigate(normalizeUrl(`/onboarding/${organization.slug}/${fallbackStep}/`));
        return;
      }

      const frameworkCategory =
        categoryList.find(category => {
          return category.platforms?.has(platform.id);
        })?.id ?? 'all';

      onboardingContext.setSelectedPlatform({
        key: location.query.platform as PlatformKey,
        category: frameworkCategory,
        language: platform.language,
        type: platform.type,
        link: platform.link,
        name: platform.name,
      });
    }
  }, [
    location.query,
    navigate,
    onboardingContext,
    organization.slug,
    location.pathname,
    hasScmOnboarding,
  ]);

  const shallProjectBeDeleted =
    stepObj?.id === 'setup-docs' && defined(isProjectActive) && !isProjectActive;

  // Called onExitComplete
  const [containerHasFooter, setContainerHasFooter] = useState(false);
  const updateAnimationState = () => {
    if (!stepObj) {
      return;
    }

    setContainerHasFooter(stepObj.hasFooter ?? false);
  };

  const goToStep = useCallback(
    (step: StepDescriptor) => {
      if (!stepObj) {
        return;
      }
      navigate(normalizeUrl(`/onboarding/${organization.slug}/${step.id}/`));
    },
    [organization.slug, navigate, stepObj]
  );

  const {handleGoBack} = useBackActions({
    stepIndex,
    onboardingSteps,
    goToStep,
    recentCreatedProject,
    isRecentCreatedProjectActive: isProjectActive,
  });

  const goNextStep = (
    step: StepDescriptor,
    platform?: OnboardingSelectedSDK,
    query?: Record<string, string[]>
  ) => {
    const currentStepIndex = onboardingSteps.findIndex(s => s.id === step.id);
    const nextStep = onboardingSteps[currentStepIndex + 1]!;

    if (
      nextStep.id === OnboardingStepId.SETUP_DOCS &&
      !platform &&
      !onboardingContext.selectedPlatform
    ) {
      return;
    }

    const pathname = `/onboarding/${organization.slug}/${nextStep.id}/`;
    navigate(query ? normalizeUrl({pathname, query}) : normalizeUrl(pathname));
  };

  const genBackButton = () => {
    if (!hasScmOnboarding || stepIndex <= 0) {
      return null;
    }
    return (
      <Button
        onClick={() => handleGoBack()}
        icon={<IconArrow direction="left" />}
        variant="link"
      >
        {t('Back')}
      </Button>
    );
  };

  const genSkipOnboardingLink = () => {
    const source = `targeted-onboarding-${stepId}`;
    return (
      <SkipOnboardingLink
        onClick={() => {
          trackAnalytics('growth.onboarding_clicked_skip', {
            organization,
            source,
          });
          onboardingContext.setSelectedPlatform(undefined);
          activateSidebar({
            userClicked: false,
            source: 'targeted_onboarding_select_platform_skip',
          });
        }}
        to={normalizeUrl(
          `/organizations/${organization.slug}/issues/?referrer=onboarding-skip`
        )}
      >
        {t('Skip Onboarding')}
      </SkipOnboardingLink>
    );
  };

  // Redirect to the first step if we end up in an invalid state
  const isInvalidDocsStep = stepId === 'setup-docs' && !projectSlug;
  if (!stepObj || stepIndex === -1 || isInvalidDocsStep) {
    return (
      <Redirect
        to={normalizeUrl(`/onboarding/${organization.slug}/${onboardingSteps[0]!.id}/`)}
      />
    );
  }

  return (
    <Stack as="main" flexGrow={1} data-test-id="targeted-onboarding">
      <SentryDocumentTitle title={stepObj.title} />
      <Header columns={{'2xs': 'repeat(2, 1fr)', md: 'repeat(3, 1fr)'}} as="header">
        <LogoSvg showWordmark={!hasScmOnboarding} />
        {stepIndex !== -1 && (
          <Flex
            justify="center"
            display={{
              '2xs': 'none',
              xs: 'none',
              sm: 'none',
              md: 'flex',
            }}
          >
            <Stepper
              numSteps={onboardingSteps.length}
              currentStepIndex={stepIndex}
              onClick={i => {
                if (i < stepIndex && shallProjectBeDeleted) {
                  handleGoBack(i);
                  return;
                }

                goToStep(onboardingSteps[i]!);
              }}
            />
          </Flex>
        )}
        <Flex align="center" justify="end" gap="md">
          <Hook
            name="onboarding:targeted-onboarding-header"
            source="targeted-onboarding"
          />
          {hasScmOnboarding && <OnboardingSkipButton stepId={stepObj.id} />}
        </Flex>
      </Header>
      <ContainerVariable
        hasFooter={containerHasFooter}
        id={stepObj.id}
        hasNewWelcomeUI={hasNewWelcomeUI}
        hasScmOnboarding={hasScmOnboarding}
      >
        {hasScmOnboarding ? null : (
          <AdaptivePageCorners
            // Controls the current corner variant
            animateVariant={stepIndex === 0 ? 'top-right' : 'top-left'}
          />
        )}
        {stepIndex > 0 && !hasScmOnboarding && (
          <BackMotionDiv
            initial="initial"
            animate="visible"
            variants={{
              initial: {opacity: 0, visibility: 'hidden'},
              visible: {
                opacity: 1,
                transition: {delay: 1},
                transitionEnd: {
                  visibility: 'visible',
                },
              },
            }}
          >
            <Button
              onClick={() => handleGoBack()}
              icon={<IconArrow direction="left" />}
              variant="link"
            >
              {t('Back')}
            </Button>
          </BackMotionDiv>
        )}
        <AnimatePresence mode="wait" onExitComplete={updateAnimationState}>
          <OnboardingStepVariable
            key={stepObj.id}
            id={stepObj.id}
            hasNewWelcomeUI={hasNewWelcomeUI}
            hasScmOnboarding={hasScmOnboarding}
          >
            {stepObj.Component && (
              <stepObj.Component
                data-test-id={`onboarding-step-${stepObj.id}`}
                stepIndex={stepIndex}
                onComplete={(platform, query) => {
                  if (stepObj) {
                    goNextStep(stepObj, platform, query);
                  }
                }}
                recentCreatedProject={recentCreatedProject}
                genSkipOnboardingLink={genSkipOnboardingLink}
                genBackButton={genBackButton}
              />
            )}
          </OnboardingStepVariable>
        </AnimatePresence>
      </ContainerVariable>
    </Stack>
  );
}

function Onboarding() {
  return (
    <OnboardingContextProvider>
      <OnboardingWithoutContext />
    </OnboardingContextProvider>
  );
}

const OnboardingContainerNewWelcomeUI = styled('div')<{
  hasFooter: boolean;
}>`
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  position: relative;
  background: ${p => p.theme.tokens.background.primary};
  padding: ${p => p.theme.space['2xl']};
  overflow: hidden;

  width: 100%;
  margin: 0 auto;
  margin-bottom: ${p => p.hasFooter && '72px'};

  @media (max-width: ${p => p.theme.breakpoints.md}) {
    padding: ${p => p.theme.space['3xl']} ${p => p.theme.space['2xl']};
  }
`;

const OnboardingContainer = styled('div')<{
  hasFooter: boolean;
  hasScmOnboarding: boolean;
}>`
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  position: relative;
  background: ${p => p.theme.tokens.background.primary};
  padding: ${p => (p.hasScmOnboarding ? '60px' : '120px')} ${p => p.theme.space['2xl']};
  width: 100%;
  margin: 0 auto;
  padding-bottom: ${p => p.hasFooter && '72px'};
  margin-bottom: ${p => p.hasFooter && '72px'};
`;

const Header = styled(Grid)`
  background: ${p => p.theme.tokens.background.primary};
  padding-left: ${p => p.theme.space['3xl']};
  padding-right: ${p => p.theme.space['3xl']};
  position: sticky;
  height: 80px;
  align-items: center;
  top: 0;
  z-index: 100;
  border-bottom: 1px solid ${p => p.theme.tokens.border.secondary};
`;

const LogoSvg = styled(LogoSentry)`
  height: 30px;
  color: ${p => p.theme.tokens.content.primary};
`;

const OnboardingStep = styled(motion.div)`
  flex-grow: 1;
  display: flex;
  flex-direction: column;
`;

const OnboardingStepNewUi = styled(motion.div)`
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
`;

const AdaptivePageCorners = styled(PageCorners)`
  --corner-scale: 1;
  overflow: hidden;
  @media (max-width: ${p => p.theme.breakpoints.sm}) {
    --corner-scale: 0.5;
  }
`;

const BackMotionDiv = styled(motion.div)`
  position: absolute;
  top: 40px;
  left: 20px;

  button {
    font-size: ${p => p.theme.font.size.sm};
  }
`;

const SkipOnboardingLink = styled(Link)`
  margin: auto ${p => p.theme.space['3xl']};
`;

export default Onboarding;
