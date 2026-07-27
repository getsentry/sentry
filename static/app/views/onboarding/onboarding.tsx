import {Fragment, useCallback, useEffect, useState, type PropsWithChildren} from 'react';
import styled from '@emotion/styled';
import {AnimatePresence, motion} from 'framer-motion';

import {Button} from '@sentry/scraps/button';
import {Container, Flex, Grid, type GridProps, Stack} from '@sentry/scraps/layout';
import {Link, type LinkProps} from '@sentry/scraps/link';

import {LogoSentry} from 'sentry/components/logoSentry';
import {
  OnboardingContextProvider,
  useOnboardingContext,
} from 'sentry/components/onboarding/onboardingContext';
import {PageCorners} from 'sentry/components/onboarding/pageCorners';
import {Stepper} from 'sentry/components/onboarding/stepper';
import {useOnboardingSidebar} from 'sentry/components/onboarding/useOnboardingSidebar';
import {useRecentCreatedProject} from 'sentry/components/onboarding/useRecentCreatedProject';
import {Override} from 'sentry/components/override';
import {Redirect} from 'sentry/components/redirect';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {categoryList} from 'sentry/data/platformPickerCategories';
import {allPlatforms as platforms} from 'sentry/data/platforms';
import {IconArrow} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {OnboardingSelectedSDK} from 'sentry/types/onboarding';
import type {PlatformKey} from 'sentry/types/platform';
import {trackAnalytics} from 'sentry/utils/analytics';
import {defined} from 'sentry/utils/defined';
import {useReplayForCriticalFlow} from 'sentry/utils/replays/useReplayForCriticalFlow';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useExperiment} from 'sentry/utils/useExperiment';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {useBackActions} from 'sentry/views/onboarding/useBackActions';
import {useHasNewWelcomeUI} from 'sentry/views/onboarding/useHasNewWelcomeUI';

import {FOOTER_HEIGHT} from './components/genericFooter';
import {NewWelcomeUI} from './components/newWelcome';
import {OnboardingSkipButton} from './components/onboardingSkipButton';
import {PlatformSelection} from './platformSelection';
import {ScmConnect} from './scmConnect';
import {ScmPlatformFeatures} from './scmPlatformFeatures';
import {ScmProjectDetails} from './scmProjectDetails';
import {SetupDocs} from './setupDocs';
import {OnboardingStepId, type StepDescriptor, type StepProps} from './types';
import {TargetedOnboardingWelcome} from './welcome';

// Genuine new-org onboarding happens shortly after org creation. Existing orgs
// only reach /onboarding via stale links + login replay and are far older than
// this window, so gating exposure on org age keeps them out of the experiment.
const NEW_ORG_ONBOARDING_WINDOW_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

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

// Adapters bridge the SCM step components — which accept all flow state via
// props — to the onboarding flow's OnboardingContext. They let the same step
// components be reused by other flows (e.g. project creation) that source
// state from somewhere other than session storage.

function ScmConnectAdapter({onComplete, genBackButton}: StepProps) {
  const {
    selectedIntegration,
    setSelectedIntegration,
    selectedRepository,
    setSelectedRepository,
    clearDerivedState,
  } = useOnboardingContext();

  return (
    <ScmConnect
      selectedIntegration={selectedIntegration}
      selectedRepository={selectedRepository}
      onIntegrationChange={setSelectedIntegration}
      onRepositoryChange={setSelectedRepository}
      onClearDerivedState={clearDerivedState}
      onComplete={onComplete}
      genBackButton={genBackButton}
    />
  );
}

function ScmPlatformFeaturesAdapter({onComplete, genBackButton}: StepProps) {
  const {
    selectedRepository,
    selectedPlatform,
    setSelectedPlatform,
    selectedFeatures,
    setSelectedFeatures,
    setProjectDetailsForm,
    createdProjectSlug,
    setCreatedProjectSlug,
  } = useOnboardingContext();

  return (
    <ScmPlatformFeatures
      selectedRepository={selectedRepository}
      selectedPlatform={selectedPlatform}
      selectedFeatures={selectedFeatures}
      createdProjectSlug={createdProjectSlug}
      onPlatformChange={setSelectedPlatform}
      onFeaturesChange={setSelectedFeatures}
      onClearProjectDetailsForm={() => setProjectDetailsForm(undefined)}
      onProjectCreated={setCreatedProjectSlug}
      onComplete={onComplete}
      genBackButton={genBackButton}
    />
  );
}

function ScmProjectDetailsAdapter({onComplete, genBackButton}: StepProps) {
  const {
    selectedPlatform,
    selectedFeatures,
    selectedRepository,
    createdProjectSlug,
    setCreatedProjectSlug,
    projectDetailsForm,
    setProjectDetailsForm,
  } = useOnboardingContext();

  return (
    <ScmProjectDetails
      selectedPlatform={selectedPlatform}
      selectedFeatures={selectedFeatures}
      selectedRepository={selectedRepository}
      createdProjectSlug={createdProjectSlug}
      projectDetailsForm={projectDetailsForm}
      onProjectCreated={setCreatedProjectSlug}
      onProjectDetailsFormChange={setProjectDetailsForm}
      onComplete={onComplete}
      genBackButton={genBackButton}
    />
  );
}

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
    Component: ScmConnectAdapter,
    cornerVariant: 'top-left',
  },
  {
    id: OnboardingStepId.SCM_PLATFORM_FEATURES,
    title: t('Create your first project'),
    Component: ScmPlatformFeaturesAdapter,
    cornerVariant: 'top-left',
  },
  {
    id: OnboardingStepId.SCM_PROJECT_DETAILS,
    title: t('Project details'),
    Component: ScmProjectDetailsAdapter,
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

  if (hasNewWelcomeUI) {
    return <NewWelcomeUI {...props} />;
  }

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
      <Fragment>
        {/*
          Padding follows the viewport, not a container: this box holds the
          step's `position: fixed` footer, so making it a query container would
          re-anchor that footer to it instead of the viewport.
        */}
        <Stack
          flexGrow={1}
          justify="center"
          position="relative"
          background="primary"
          overflow="hidden"
          padding={{'screen:2xs': '3xl 2xl', 'screen:md': '2xl'}}
          width="100%"
          marginLeft="auto"
          marginRight="auto"
        >
          {props.children}
        </Stack>
        {/*
          Reserves the space the fixed footer overlays. A sibling with a height,
          rather than bottom spacing on the box above: the spacing props only
          take space-scale tokens, which stop well short of the footer.
        */}
        <Container flexShrink={0} height={FOOTER_HEIGHT} />
      </Fragment>
    );
  }

  return (
    <OnboardingContainer
      flexGrow={1}
      width="100%"
      marginLeft="auto"
      marginRight="auto"
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
  const centered =
    props.hasNewWelcomeUI &&
    props.id === OnboardingStepId.WELCOME &&
    !props.hasScmOnboarding;

  return (
    <OnboardingStep
      flexGrow={1}
      justify={centered ? 'center' : undefined}
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
    </OnboardingStep>
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

  // Only report experiment exposure for genuine new-org onboarding. Existing
  // orgs can land on /onboarding via stale links, which would
  // otherwise contaminate the experiment population. reportExposure does not
  // affect the returned `inExperiment` assignment, so step selection below still
  // works for everyone.
  const isNewOrgOnboarding =
    Date.now() - new Date(organization.dateCreated).getTime() <
    NEW_ORG_ONBOARDING_WINDOW_MS;

  const {inExperiment: hasScmOnboarding} = useExperiment({
    feature: 'onboarding-scm-experiment',
    reportExposure: isNewOrgOnboarding,
  });

  // Only report exposure for users who are actually in SCM onboarding —
  // the assignment is irrelevant for legacy onboarding.
  const {inExperiment: hasProjectDetailsStep} = useExperiment({
    feature: 'onboarding-scm-project-details-experiment',
    reportExposure: hasScmOnboarding && isNewOrgOnboarding,
  });

  const scmSteps = hasProjectDetailsStep
    ? scmOnboardingSteps
    : scmOnboardingSteps.filter(s => s.id !== OnboardingStepId.SCM_PROJECT_DETAILS);

  const onboardingSteps = hasScmOnboarding ? scmSteps : legacyOnboardingSteps;

  useReplayForCriticalFlow({
    flowName: 'scm_onboarding',
    enabled: hasScmOnboarding,
    sampleRate: 0.5,
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
      <Header columns={{'screen:2xs': 'repeat(2, 1fr)', 'screen:md': 'repeat(3, 1fr)'}}>
        <LogoSvg showWordmark={!hasScmOnboarding} />
        {stepIndex !== -1 && (
          <Flex
            justify="center"
            display={{
              'screen:2xs': 'none',
              'screen:xs': 'none',
              'screen:sm': 'none',
              'screen:md': 'flex',
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
          <Override
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
          // Query container for the corner scale below. It wraps only the
          // decorations, so its containment can't re-anchor the `position:
          // fixed` step footers that also live in OnboardingContainer.
          <Container
            position="absolute"
            inset={0}
            pointerEvents="none"
            containerType="inline-size"
          >
            <AdaptivePageCorners
              // Controls the current corner variant
              animateVariant={stepIndex === 0 ? 'top-right' : 'top-left'}
            />
          </Container>
        )}
        {stepIndex > 0 && !hasScmOnboarding && (
          <BackMotionDiv
            position="absolute"
            top="40px"
            left="20px"
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

// Stays a styled component: its vertical padding (60/120px) and footer
// clearance are all off the space scale, so converting the handful of
// remaining declarations to props would split one rule across two mechanisms
// for no gain.
const OnboardingContainer = styled(Stack)<{
  hasFooter: boolean;
  hasScmOnboarding: boolean;
}>`
  position: relative;
  overflow-x: hidden;
  background: ${p => p.theme.tokens.background.primary};
  padding: ${p => (p.hasScmOnboarding ? '60px' : '120px')} ${p => p.theme.space['2xl']};
  padding-bottom: ${p => p.hasFooter && FOOTER_HEIGHT};
  margin-bottom: ${p => p.hasFooter && FOOTER_HEIGHT};
`;

// Only the stacking order isn't a Grid prop.
const Header = styled((props: GridProps<'header'>) => (
  <Grid
    as="header"
    background="primary"
    paddingLeft="3xl"
    paddingRight="3xl"
    position="sticky"
    height="80px"
    align="center"
    top={0}
    borderBottom="secondary"
    {...props}
  />
))`
  z-index: 100;
`;

const LogoSvg = styled(LogoSentry)`
  height: 30px;
  color: ${p => p.theme.tokens.content.primary};
`;

const OnboardingStep = motion.create(Stack);

const AdaptivePageCorners = styled(PageCorners)`
  --corner-scale: 1;
  overflow: hidden;
  @container (max-width: ${p => p.theme.container.xl}) {
    --corner-scale: 0.5;
  }
`;

// Sizes the button it wraps, which a descendant selector can do and a prop
// can't — the Button is supplied by the caller.
const BackMotionDiv = styled(motion.create(Container))`
  button {
    font-size: ${p => p.theme.font.size.sm};
  }
`;

function SkipOnboardingLink(props: LinkProps) {
  return (
    <Container margin="auto 3xl">
      {({className}) => <Link className={className} {...props} />}
    </Container>
  );
}

export default Onboarding;
