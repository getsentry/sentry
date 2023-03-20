import {useCallback, useContext, useEffect, useRef, useState} from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import {AnimatePresence, motion, MotionProps, useAnimation} from 'framer-motion';

import {removeProject} from 'sentry/actionCreators/projects';
import {Button, ButtonProps} from 'sentry/components/button';
import Hook from 'sentry/components/hook';
import Link from 'sentry/components/links/link';
import LogoSentry from 'sentry/components/logoSentry';
import {OnboardingContext} from 'sentry/components/onboarding/onboardingContext';
import {PRODUCT} from 'sentry/components/onboarding/productSelection';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {PlatformKey} from 'sentry/data/platformCategories';
import {IconArrow} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {OnboardingStatus} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import handleXhrErrorResponse from 'sentry/utils/handleXhrErrorResponse';
import Redirect from 'sentry/utils/redirect';
import testableTransition from 'sentry/utils/testableTransition';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import PageCorners from 'sentry/views/onboarding/components/pageCorners';

import Stepper from './components/stepper';
import OnboardingPlatform from './deprecatedPlatform';
import {PlatformSelection} from './platformSelection';
import SetupDocs from './setupDocs';
import {StepDescriptor} from './types';
import {usePersistedOnboardingState} from './utils';
import TargetedOnboardingWelcome from './welcome';

type RouteParams = {
  step: string;
};

type Props = RouteComponentProps<RouteParams, {}>;

function getOrganizationOnboardingSteps(singleSelectPlatform: boolean): StepDescriptor[] {
  return [
    {
      id: 'welcome',
      title: t('Welcome'),
      Component: TargetedOnboardingWelcome,
      cornerVariant: 'top-right',
    },
    {
      ...(singleSelectPlatform
        ? {
            id: 'select-platform',
            title: t('Select platform'),
            Component: PlatformSelection,
            hasFooter: true,
            cornerVariant: 'top-left',
          }
        : {
            id: 'select-platform',
            title: t('Select platforms'),
            Component: OnboardingPlatform,
            hasFooter: true,
            cornerVariant: 'top-left',
          }),
    },
    {
      id: 'setup-docs',
      title: t('Install the Sentry SDK'),
      Component: SetupDocs,
      hasFooter: true,
      cornerVariant: 'top-left',
    },
  ];
}

function Onboarding(props: Props) {
  const api = useApi();
  const organization = useOrganization();
  const [clientState, setClientState] = usePersistedOnboardingState();
  const onboardingContext = useContext(OnboardingContext);
  const selectedPlatforms = clientState?.selectedPlatforms || [];
  const selectedProjectSlug = selectedPlatforms[0];

  const {
    params: {step: stepId},
  } = props;

  const cornerVariantTimeoutRed = useRef<number | undefined>(undefined);

  useEffect(() => {
    return () => {
      window.clearTimeout(cornerVariantTimeoutRed.current);
    };
  }, []);

  const heartbeatFooter = !!organization?.features.includes(
    'onboarding-heartbeat-footer'
  );

  const singleSelectPlatform = !!organization?.features.includes(
    'onboarding-remove-multiselect-platform'
  );

  const projectDeletionOnBackClick = !!organization?.features.includes(
    'onboarding-project-deletion-on-back-click'
  );

  const onboardingSteps = getOrganizationOnboardingSteps(singleSelectPlatform);
  const stepObj = onboardingSteps.find(({id}) => stepId === id);
  const stepIndex = onboardingSteps.findIndex(({id}) => stepId === id);

  const cornerVariantControl = useAnimation();
  const updateCornerVariant = () => {
    // TODO: find better way to delay the corner animation
    window.clearTimeout(cornerVariantTimeoutRed.current);

    cornerVariantTimeoutRed.current = window.setTimeout(
      () => cornerVariantControl.start(stepIndex === 0 ? 'top-right' : 'top-left'),
      1000
    );
  };

  useEffect(updateCornerVariant, [stepIndex, cornerVariantControl]);

  // Called onExitComplete
  const [containerHasFooter, setContainerHasFooter] = useState<boolean>(false);
  const updateAnimationState = () => {
    if (!stepObj) {
      return;
    }

    setContainerHasFooter(stepObj.hasFooter ?? false);
  };

  const goToStep = (step: StepDescriptor) => {
    if (!stepObj) {
      return;
    }
    if (step.cornerVariant !== stepObj.cornerVariant) {
      cornerVariantControl.start('none');
    }
    props.router.push(normalizeUrl(`/onboarding/${organization.slug}/${step.id}/`));
  };

  const goNextStep = useCallback(
    (step: StepDescriptor) => {
      if (!selectedProjectSlug) {
        return;
      }

      const currentStepIndex = onboardingSteps.findIndex(s => s.id === step.id);
      const nextStep = onboardingSteps[currentStepIndex + 1];

      if (step.cornerVariant !== nextStep.cornerVariant) {
        cornerVariantControl.start('none');
      }

      if (nextStep.id === 'setup-docs' && selectedProjectSlug === 'javascript-react') {
        props.router.push(
          normalizeUrl(
            `/onboarding/${organization.slug}/${nextStep.id}/?product=${PRODUCT.PERFORMANCE_MONITORING}&product=${PRODUCT.SESSION_REPLAY}`
          )
        );
        return;
      }
      props.router.push(normalizeUrl(`/onboarding/${organization.slug}/${nextStep.id}/`));
    },
    [
      selectedProjectSlug,
      organization.slug,
      onboardingSteps,
      cornerVariantControl,
      props.router,
    ]
  );

  const deleteProject = useCallback(
    async (projectSlug: string) => {
      try {
        await removeProject(api, organization.slug, projectSlug);
      } catch (error) {
        handleXhrErrorResponse(t('Unable to delete project'))(error);
        // we don't give the user any feedback regarding this error as this shall be silent
      }
    },
    [api, organization.slug]
  );

  const handleGoBack = useCallback(() => {
    if (!stepObj) {
      return;
    }

    const previousStep = onboardingSteps[stepIndex - 1];

    if (!previousStep) {
      return;
    }

    if (stepObj.cornerVariant !== previousStep.cornerVariant) {
      cornerVariantControl.start('none');
    }

    trackAdvancedAnalyticsEvent('onboarding.back_button_clicked', {
      organization,
      from: onboardingSteps[stepIndex].id,
      to: previousStep.id,
    });

    // from selected platform to welcome
    if (onboardingSteps[stepIndex].id === 'select-platform') {
      setClientState({
        platformToProjectIdMap: clientState?.platformToProjectIdMap ?? {},
        selectedPlatforms: [],
        url: 'welcome/',
        state: undefined,
      });
    }

    // from setup docs to selected platform
    if (onboardingSteps[stepIndex].id === 'setup-docs' && projectDeletionOnBackClick) {
      // The user is going back to select a new platform,
      // so we silently delete the last created project
      // if the user didn't send an first error yet.

      const projectShallBeRemoved = !Object.keys(onboardingContext.data).some(
        key =>
          onboardingContext.data[key].slug === selectedProjectSlug &&
          (onboardingContext.data[key].status === OnboardingStatus.PROCESSING ||
            onboardingContext.data[key].status === OnboardingStatus.PROCESSED)
      );

      let platformToProjectIdMap = clientState?.platformToProjectIdMap ?? {};

      if (projectShallBeRemoved) {
        deleteProject(selectedProjectSlug);

        platformToProjectIdMap = Object.keys(
          clientState?.platformToProjectIdMap ?? {}
        ).reduce((acc, platform) => {
          if (!acc[platform] && platform !== selectedProjectSlug) {
            acc[platform] = platform;
          }
          return acc;
        }, {});
      }

      setClientState({
        url: 'select-platform/',
        state: 'projects_selected',
        selectedPlatforms: [selectedProjectSlug as PlatformKey],
        platformToProjectIdMap,
      });
    }

    props.router.replace(
      normalizeUrl(`/onboarding/${organization.slug}/${previousStep.id}/`)
    );
  }, [
    stepObj,
    stepIndex,
    onboardingSteps,
    organization,
    cornerVariantControl,
    clientState,
    setClientState,
    selectedProjectSlug,
    props.router,
    deleteProject,
    projectDeletionOnBackClick,
    onboardingContext,
  ]);

  const genSkipOnboardingLink = () => {
    const source = `targeted-onboarding-${stepId}`;
    return (
      <SkipOnboardingLink
        onClick={() => {
          trackAdvancedAnalyticsEvent('growth.onboarding_clicked_skip', {
            organization,
            source,
          });
          if (clientState) {
            setClientState({
              ...clientState,
              state: 'skipped',
            });
          }
        }}
        to={normalizeUrl(
          `/organizations/${organization.slug}/issues/?referrer=onboarding-skip`
        )}
      >
        {t('Skip Onboarding')}
      </SkipOnboardingLink>
    );
  };

  const jumpToSetupProject = useCallback(() => {
    const nextStep = onboardingSteps.find(({id}) => id === 'setup-docs');
    if (!nextStep) {
      Sentry.captureMessage(
        'Missing step in onboarding: `setup-docs` when trying to jump there'
      );
      return;
    }
    props.router.push(normalizeUrl(`/onboarding/${organization.slug}/${nextStep.id}/`));
  }, [onboardingSteps, organization, props.router]);

  if (!stepObj || stepIndex === -1) {
    return (
      <Redirect
        to={normalizeUrl(`/onboarding/${organization.slug}/${onboardingSteps[0].id}/`)}
      />
    );
  }

  return (
    <OnboardingWrapper data-test-id="targeted-onboarding">
      <SentryDocumentTitle title={stepObj.title} />
      <Header>
        <LogoSvg />
        {stepIndex !== -1 && (
          <StyledStepper
            numSteps={onboardingSteps.length}
            currentStepIndex={stepIndex}
            onClick={i => goToStep(onboardingSteps[i])}
          />
        )}
        <UpsellWrapper>
          <Hook
            name="onboarding:targeted-onboarding-header"
            source="targeted-onboarding"
          />
        </UpsellWrapper>
      </Header>
      <Container hasFooter={containerHasFooter} heartbeatFooter={heartbeatFooter}>
        <Back animate={stepIndex > 0 ? 'visible' : 'hidden'} onClick={handleGoBack} />
        <AnimatePresence exitBeforeEnter onExitComplete={updateAnimationState}>
          <OnboardingStep key={stepObj.id} data-test-id={`onboarding-step-${stepObj.id}`}>
            {stepObj.Component && (
              <stepObj.Component
                active
                data-test-id={`onboarding-step-${stepObj.id}`}
                stepIndex={stepIndex}
                onComplete={() => stepObj && goNextStep(stepObj)}
                orgId={organization.slug}
                search={props.location.search}
                route={props.route}
                router={props.router}
                location={props.location}
                jumpToSetupProject={jumpToSetupProject}
                {...{
                  genSkipOnboardingLink,
                }}
              />
            )}
          </OnboardingStep>
        </AnimatePresence>
        <AdaptivePageCorners animateVariant={cornerVariantControl} />
      </Container>
    </OnboardingWrapper>
  );
}

const Container = styled('div')<{hasFooter: boolean; heartbeatFooter: boolean}>`
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  position: relative;
  background: ${p => p.theme.background};
  padding: ${p =>
    p.heartbeatFooter ? `120px ${space(3)} 0 ${space(3)}` : `120px ${space(3)}`};
  width: 100%;
  margin: 0 auto;
  padding-bottom: ${p => p.hasFooter && '72px'};
  margin-bottom: ${p => p.hasFooter && '72px'};
`;

const Header = styled('header')`
  background: ${p => p.theme.background};
  padding-left: ${space(4)};
  padding-right: ${space(4)};
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
  color: ${p => p.theme.textColor};
`;

const OnboardingStep = styled(motion.div)`
  flex-grow: 1;
  display: flex;
  flex-direction: column;
`;

OnboardingStep.defaultProps = {
  initial: 'initial',
  animate: 'animate',
  exit: 'exit',
  variants: {animate: {}},
  transition: testableTransition({
    staggerChildren: 0.2,
  }),
};

const Sidebar = styled(motion.div)`
  width: 850px;
  display: flex;
  flex-direction: column;
  align-items: center;
`;

Sidebar.defaultProps = {
  initial: 'initial',
  animate: 'animate',
  exit: 'exit',
  variants: {animate: {}},
  transition: testableTransition({
    staggerChildren: 0.2,
  }),
};

const AdaptivePageCorners = styled(PageCorners)`
  --corner-scale: 1;
  @media (max-width: ${p => p.theme.breakpoints.small}) {
    --corner-scale: 0.5;
  }
`;

const StyledStepper = styled(Stepper)`
  justify-self: center;
  @media (max-width: ${p => p.theme.breakpoints.medium}) {
    display: none;
  }
`;

interface BackButtonProps extends Omit<ButtonProps, 'icon' | 'priority'> {
  animate: MotionProps['animate'];
  className?: string;
}

const Back = styled(({className, animate, ...props}: BackButtonProps) => (
  <motion.div
    className={className}
    animate={animate}
    transition={testableTransition()}
    variants={{
      initial: {opacity: 0, visibility: 'hidden'},
      visible: {
        opacity: 1,
        visibility: 'visible',
        transition: testableTransition({delay: 1}),
      },
      hidden: {
        opacity: 0,
        transitionEnd: {
          visibility: 'hidden',
        },
      },
    }}
  >
    <Button {...props} icon={<IconArrow direction="left" size="sm" />} priority="link">
      {t('Back')}
    </Button>
  </motion.div>
))`
  position: absolute;
  top: 40px;
  left: 20px;

  button {
    font-size: ${p => p.theme.fontSizeSmall};
  }
`;

const SkipOnboardingLink = styled(Link)`
  margin: auto ${space(4)};
`;

const UpsellWrapper = styled('div')`
  grid-column: 3;
  margin-left: auto;
`;

const OnboardingWrapper = styled('main')`
  flex-grow: 1;
  display: flex;
  flex-direction: column;
`;

export default Onboarding;
