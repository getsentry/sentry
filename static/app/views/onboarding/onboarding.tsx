import {useCallback, useEffect, useState, type PropsWithChildren} from 'react';
import styled from '@emotion/styled';
import {AnimatePresence, motion} from 'framer-motion';

import {Button} from '@sentry/scraps/button';
import {Container, Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';

import {AnimatedSentryLogo} from 'sentry/components/animatedSentryLogo';
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
    title: t('Platform & features'),
    Component: ScmPlatformFeatures,
    cornerVariant: 'top-left',
  },
  {
    id: OnboardingStepId.SCM_PROJECT_DETAILS,
    title: t('Project details'),
    Component: ScmProjectDetails,
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

/**
 * The SCM steps that display the animated logo progress indicator.
 * Order determines the progress level (first = 0, last = 1).
 */
const SCM_LOGO_STEPS = [
  OnboardingStepId.SCM_CONNECT,
  OnboardingStepId.SCM_PLATFORM_FEATURES,
  OnboardingStepId.SCM_PROJECT_DETAILS,
];

function WelcomeVariable(props: StepProps) {
  const hasNewWelcomeUI = useHasNewWelcomeUI();

  if (hasNewWelcomeUI) return <NewWelcomeUI {...props} />;

  return <TargetedOnboardingWelcome {...props} />;
}

interface ContainerVariableProps {
  hasFooter: boolean;
  hasNewWelcomeUI: boolean;
  id: OnboardingStepId;
}

function ContainerVariable(props: PropsWithChildren<ContainerVariableProps>) {
  const newWelcomeUIStep = props.hasNewWelcomeUI && props.id === OnboardingStepId.WELCOME;
  const Component = newWelcomeUIStep
    ? OnboardingContainerNewWelcomeUI
    : OnboardingContainer;

  return (
    <Component hasFooter={props.hasFooter || newWelcomeUIStep}>
      {props.children}
    </Component>
  );
}

interface OnboardingStepVariableProps {
  hasNewWelcomeUI: boolean;
  id: OnboardingStepId;
}

function OnboardingStepVariable(props: PropsWithChildren<OnboardingStepVariableProps>) {
  const Component =
    props.hasNewWelcomeUI && props.id === OnboardingStepId.WELCOME
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
      key={props.id}
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
  });

  const onboardingSteps = hasScmOnboarding ? scmOnboardingSteps : legacyOnboardingSteps;

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
  const [containerHasFooter, setContainerHasFooter] = useState<boolean>(false);
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

  const goNextStep = useCallback(
    (
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
    },
    [organization.slug, navigate, onboardingSteps, onboardingContext.selectedPlatform]
  );

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

  const scmLogoIndex = stepObj ? SCM_LOGO_STEPS.indexOf(stepObj.id) : -1;
  const scmLogoProgress =
    scmLogoIndex >= 0 && SCM_LOGO_STEPS.length > 1
      ? scmLogoIndex / (SCM_LOGO_STEPS.length - 1)
      : null;

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
      <Header>
        <LogoSvg />
        {stepIndex !== -1 && (
          <StyledStepper
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
        )}
        <UpsellWrapper>
          <Hook
            name="onboarding:targeted-onboarding-header"
            source="targeted-onboarding"
          />
        </UpsellWrapper>
      </Header>
      <ContainerVariable
        hasFooter={containerHasFooter}
        id={stepObj.id}
        hasNewWelcomeUI={hasNewWelcomeUI}
      >
        <AdaptivePageCorners
          // Controls the current corner variant
          animateVariant={stepIndex === 0 ? 'top-right' : 'top-left'}
        />
        {stepIndex > 0 && (
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
              priority="link"
            >
              {t('Back')}
            </Button>
          </BackMotionDiv>
        )}
        {scmLogoProgress !== null && (
          <Container alignSelf="center">
            <AnimatedSentryLogo progress={scmLogoProgress} />
          </Container>
        )}
        <AnimatePresence mode="wait" onExitComplete={updateAnimationState}>
          <OnboardingStepVariable id={stepObj.id} hasNewWelcomeUI={hasNewWelcomeUI}>
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

const OnboardingContainerNewWelcomeUI = styled('div')<{hasFooter: boolean}>`
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

const OnboardingContainer = styled('div')<{hasFooter: boolean}>`
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  position: relative;
  background: ${p => p.theme.tokens.background.primary};
  padding: 120px ${p => p.theme.space['2xl']};
  width: 100%;
  margin: 0 auto;
  padding-bottom: ${p => p.hasFooter && '72px'};
  margin-bottom: ${p => p.hasFooter && '72px'};
`;

const Header = styled('header')`
  background: ${p => p.theme.tokens.background.primary};
  padding-left: ${p => p.theme.space['3xl']};
  padding-right: ${p => p.theme.space['3xl']};
  position: sticky;
  height: 80px;
  align-items: center;
  top: 0;
  z-index: 100;
  box-shadow: 0 5px 10px rgba(0, 0, 0, 0.05);
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  justify-items: stretch;
`;

const LogoSvg = styled(LogoSentry)`
  width: 130px;
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

const StyledStepper = styled(Stepper)`
  justify-self: center;
  @media (max-width: ${p => p.theme.breakpoints.md}) {
    display: none;
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

const UpsellWrapper = styled('div')`
  grid-column: 3;
  margin-left: auto;
`;

export default Onboarding;
