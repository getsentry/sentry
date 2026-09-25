import {useCallback, useEffect, useState} from 'react';
import styled from '@emotion/styled';
import {AnimatePresence, motion} from 'framer-motion';

import {Button} from '@sentry/scraps/button';
import {Flex, Grid, Stack} from '@sentry/scraps/layout';

import {LogoSentry} from 'sentry/components/logoSentry';
import {
  OnboardingContextProvider,
  useOnboardingContext,
} from 'sentry/components/onboarding/onboardingContext';
import {Stepper} from 'sentry/components/onboarding/stepper';
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
import {defined} from 'sentry/utils/defined';
import {useReplayForCriticalFlow} from 'sentry/utils/replays/useReplayForCriticalFlow';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useExperiment} from 'sentry/utils/useExperiment';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {useBackActions} from 'sentry/views/onboarding/useBackActions';

import {FOOTER_HEIGHT} from './components/genericFooter';
import {NewWelcomeUI} from './components/newWelcome';
import {OnboardingSkipButton} from './components/onboardingSkipButton';
import {ScmConnect} from './scmConnect';
import {ScmMessaging, SCM_MESSAGING_TITLE} from './scmMessaging';
import {ScmPlatformFeatures} from './scmPlatformFeatures';
import {SetupDocs} from './setupDocs';
import {OnboardingStepId, type StepDescriptor, type StepProps} from './types';

// Genuine new-org onboarding happens shortly after org creation. Existing orgs
// only reach /onboarding via stale links + login replay and are far older than
// this window, so gating exposure on org age keeps them out of the experiment.
const NEW_ORG_ONBOARDING_WINDOW_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

/**
 * On now that the messaging experiment has a rollout segment. Keep this as the
 * one place to turn reporting off again if the rollout is pulled, so the
 * experiment population does not fill with rows from a control-only config.
 */
const SCM_MESSAGING_EXPOSURE_ENABLED = true;

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

function ScmPlatformFeaturesAdapter({
  deferProjectCreation,
  genBackButton,
  onComplete,
}: StepProps & {deferProjectCreation: boolean}) {
  const {
    selectedRepository,
    selectedPlatform,
    setSelectedPlatform,
    selectedFeatures,
    setSelectedFeatures,
    createdProject,
    setCreatedProject,
  } = useOnboardingContext();

  return (
    <ScmPlatformFeatures
      selectedRepository={selectedRepository}
      selectedPlatform={selectedPlatform}
      selectedFeatures={selectedFeatures}
      createdProject={createdProject}
      deferProjectCreation={deferProjectCreation}
      onPlatformChange={setSelectedPlatform}
      onFeaturesChange={setSelectedFeatures}
      onCreatedProjectChange={setCreatedProject}
      onComplete={onComplete}
      genBackButton={genBackButton}
    />
  );
}

function ScmPlatformFeaturesControlAdapter(props: StepProps) {
  return <ScmPlatformFeaturesAdapter {...props} deferProjectCreation={false} />;
}

function ScmPlatformFeaturesTreatmentAdapter(props: StepProps) {
  return <ScmPlatformFeaturesAdapter {...props} deferProjectCreation />;
}

function ScmMessagingAdapter({genBackButton, onComplete}: StepProps) {
  const {
    createdProject,
    messagingSetup,
    selectedFeatures,
    selectedPlatform,
    selectedRepository,
    setCreatedProject,
    setMessagingSetup,
  } = useOnboardingContext();

  // Type-narrowing only. `isInvalidMessagingStep` below redirects away from
  // this step before it renders without a platform, so this is unreachable —
  // it is not an empty state and should not grow into one.
  if (!selectedPlatform) {
    return null;
  }

  return (
    <ScmMessaging
      createdProject={createdProject}
      messagingSetup={messagingSetup}
      onCreatedProjectChange={setCreatedProject}
      onMessagingSetupChange={setMessagingSetup}
      onComplete={onComplete}
      selectedFeatures={selectedFeatures}
      selectedPlatform={selectedPlatform}
      selectedRepository={selectedRepository}
      genBackButton={genBackButton}
    />
  );
}

const scmOnboardingSharedSteps: StepDescriptor[] = [
  {
    id: OnboardingStepId.WELCOME,
    title: t('Welcome'),
    Component: NewWelcomeUI,
  },
  {
    id: OnboardingStepId.SCM_CONNECT,
    title: t('Connect repository'),
    Component: ScmConnectAdapter,
  },
];

const scmOnboardingSteps: StepDescriptor[] = [
  ...scmOnboardingSharedSteps,
  {
    id: OnboardingStepId.SCM_PLATFORM_FEATURES,
    title: t('Create your first project'),
    Component: ScmPlatformFeaturesControlAdapter,
  },
  {
    id: OnboardingStepId.SETUP_DOCS,
    title: t('Install the Sentry SDK'),
    Component: SetupDocs,
    hasFooter: true,
  },
];

const scmMessagingOnboardingSteps: StepDescriptor[] = [
  ...scmOnboardingSharedSteps,
  {
    id: OnboardingStepId.SCM_PLATFORM_FEATURES,
    title: t('Create your first project'),
    Component: ScmPlatformFeaturesTreatmentAdapter,
  },
  {
    id: OnboardingStepId.SCM_MESSAGING,
    title: SCM_MESSAGING_TITLE,
    Component: ScmMessagingAdapter,
  },
  {
    id: OnboardingStepId.SETUP_DOCS,
    title: t('Install the Sentry SDK'),
    Component: SetupDocs,
    hasFooter: true,
  },
];

export function OnboardingWithoutContext() {
  const location = useLocation();
  const navigate = useNavigate();
  const {step: stepId} = useParams<{step: string}>();
  const organization = useOrganization();
  const onboardingContext = useOnboardingContext();
  const selectedProjectSlug =
    onboardingContext.createdProject?.slug ?? onboardingContext.selectedPlatform?.key;

  // Only report experiment exposure for genuine new-org onboarding. Existing
  // orgs can land on /onboarding via stale links, which would
  // otherwise contaminate the experiment population. reportExposure does not
  // affect the returned `inExperiment` assignment, so step selection below still
  // works for everyone.
  const [isNewOrgOnboarding] = useState(
    () =>
      Date.now() - new Date(organization.dateCreated).getTime() <
      NEW_ORG_ONBOARDING_WINDOW_MS
  );

  // The arms first differ after platform/features: treatment continues to the
  // messaging step, control to SDK setup. Exposure is reported once the user
  // is past that fork, from the route rather than the step list because the
  // list itself depends on this assignment.
  //
  // The route alone is not enough: the invalid-state guards below redirect off
  // both of these steps, and the redirect runs in an effect, so a bare route
  // check reports exposure for a user who is sent back before either arm
  // renders. Repeat the same staged-state conditions here.
  const isPastPlatformFeatures =
    (stepId === OnboardingStepId.SCM_MESSAGING &&
      defined(onboardingContext.selectedPlatform)) ||
    (stepId === OnboardingStepId.SETUP_DOCS && defined(selectedProjectSlug));
  const {inExperiment: hasScmMessaging} = useExperiment({
    feature: 'onboarding-scm-messaging-experiment',
    reportExposure:
      SCM_MESSAGING_EXPOSURE_ENABLED && isNewOrgOnboarding && isPastPlatformFeatures,
  });

  const onboardingSteps = hasScmMessaging
    ? scmMessagingOnboardingSteps
    : scmOnboardingSteps;

  useReplayForCriticalFlow({
    flowName: 'scm_onboarding',
    enabled: true,
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
        navigate(
          normalizeUrl(
            `/onboarding/${organization.slug}/${OnboardingStepId.SCM_PLATFORM_FEATURES}/`
          )
        );
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
  }, [location.query, navigate, onboardingContext, organization.slug, location.pathname]);

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
    if (stepIndex <= 0) {
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

  // Redirect to the first step if we end up in an invalid state
  const isInvalidDocsStep = stepId === OnboardingStepId.SETUP_DOCS && !projectSlug;
  // Keyed off `stepObj` rather than the experiment flag so the fallback below is
  // always a step in the active list: `scm-messaging` only exists alongside
  // `scm-platform-features`. Testing the flag instead would send a flow whose
  // step list has neither on a second redirect to reach the first step.
  const isInvalidMessagingStep =
    stepObj?.id === OnboardingStepId.SCM_MESSAGING && !onboardingContext.selectedPlatform;
  if (!stepObj || stepIndex === -1 || isInvalidDocsStep || isInvalidMessagingStep) {
    const fallbackStep = isInvalidMessagingStep
      ? OnboardingStepId.SCM_PLATFORM_FEATURES
      : onboardingSteps[0]!.id;
    return (
      <Redirect to={normalizeUrl(`/onboarding/${organization.slug}/${fallbackStep}/`)} />
    );
  }

  return (
    <Stack as="main" flexGrow={1} data-test-id="targeted-onboarding">
      <SentryDocumentTitle title={stepObj.title} />
      <Header
        columns={{'screen:2xs': 'repeat(2, 1fr)', 'screen:md': 'repeat(3, 1fr)'}}
        as="header"
      >
        <LogoSvg showWordmark={false} />
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
          <OnboardingSkipButton stepId={stepObj.id} />
        </Flex>
      </Header>
      <OnboardingContainer hasFooter={containerHasFooter}>
        <AnimatePresence mode="wait" onExitComplete={updateAnimationState}>
          <OnboardingStep
            key={stepObj.id}
            initial="initial"
            animate="animate"
            exit="exit"
            variants={{animate: {}}}
            transition={{staggerChildren: 0.2}}
            data-test-id={`onboarding-step-${stepObj.id}`}
          >
            {stepObj.Component && (
              <stepObj.Component
                data-test-id={`onboarding-step-${stepObj.id}`}
                onComplete={(platform, query) => {
                  if (stepObj) {
                    goNextStep(stepObj, platform, query);
                  }
                }}
                recentCreatedProject={recentCreatedProject}
                genBackButton={genBackButton}
              />
            )}
          </OnboardingStep>
        </AnimatePresence>
      </OnboardingContainer>
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

const OnboardingContainer = styled('div')<{
  hasFooter: boolean;
}>`
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow-x: hidden;
  background: ${p => p.theme.tokens.background.primary};
  padding: 60px ${p => p.theme.space['2xl']};
  width: 100%;
  margin: 0 auto;
  padding-bottom: ${p => p.hasFooter && FOOTER_HEIGHT};
  margin-bottom: ${p => p.hasFooter && FOOTER_HEIGHT};
`;

const Header = styled(Grid)`
  background: ${p => p.theme.tokens.background.primary};
  padding: ${p => p.theme.space.md} ${p => p.theme.space['3xl']};
  position: sticky;
  min-height: 60px;
  align-items: center;
  top: 0;
  z-index: 100;
  border-bottom: 1px solid ${p => p.theme.tokens.border.secondary};
`;

const LogoSvg = styled(LogoSentry)`
  height: 24px;
  color: ${p => p.theme.tokens.content.primary};
`;

const OnboardingStep = styled(motion.div)`
  flex-grow: 1;
  display: flex;
  flex-direction: column;
`;

export default Onboarding;
