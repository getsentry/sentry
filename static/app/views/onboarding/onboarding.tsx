import {useEffect, useRef, useState} from 'react';
import {browserHistory, RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import {AnimatePresence, motion, MotionProps, useAnimation} from 'framer-motion';

import Button, {ButtonProps} from 'sentry/components/button';
import Hook from 'sentry/components/hook';
import Link from 'sentry/components/links/link';
import LogoSentry from 'sentry/components/logoSentry';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {IconArrow} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization, Project} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import Redirect from 'sentry/utils/redirect';
import testableTransition from 'sentry/utils/testableTransition';
import withOrganization from 'sentry/utils/withOrganization';
import withProjects from 'sentry/utils/withProjects';
import PageCorners from 'sentry/views/onboarding/components/pageCorners';

import Stepper from './components/stepper';
import PlatformSelection from './platform';
import SetupDocs from './setupDocs';
import {StepDescriptor} from './types';
import {usePersistedOnboardingState} from './utils';
import TargetedOnboardingWelcome from './welcome';

type RouteParams = {
  orgId: string;
  step: string;
};

type Props = RouteComponentProps<RouteParams, {}> & {
  organization: Organization;
  projects: Project[];
};

function getOrganizationOnboardingSteps(): StepDescriptor[] {
  return [
    {
      id: 'welcome',
      title: t('Welcome'),
      Component: TargetedOnboardingWelcome,
      cornerVariant: 'top-right',
    },
    {
      id: 'select-platform',
      title: t('Select platforms'),
      Component: PlatformSelection,
      hasFooter: true,
      cornerVariant: 'top-left',
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
  const {
    organization,
    params: {step: stepId},
  } = props;
  const cornerVariantTimeoutRed = useRef<number | undefined>(undefined);
  const [clientState, setClientState] = usePersistedOnboardingState();

  useEffect(() => {
    return () => {
      window.clearTimeout(cornerVariantTimeoutRed.current);
    };
  }, []);
  const onboardingSteps = getOrganizationOnboardingSteps();
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
    browserHistory.push(`/onboarding/${props.params.orgId}/${step.id}/`);
  };

  const goNextStep = (step: StepDescriptor) => {
    const currentStepIndex = onboardingSteps.findIndex(s => s.id === step.id);
    const nextStep = onboardingSteps[currentStepIndex + 1];
    if (step.cornerVariant !== nextStep.cornerVariant) {
      cornerVariantControl.start('none');
    }
    browserHistory.push(`/onboarding/${props.params.orgId}/${nextStep.id}/`);
  };

  const handleGoBack = () => {
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
    browserHistory.replace(`/onboarding/${props.params.orgId}/${previousStep.id}/`);
  };

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
        to={`/organizations/${organization.slug}/issues/?referrer=onboarding-skip`}
      >
        {t('Skip Onboarding')}
      </SkipOnboardingLink>
    );
  };

  if (!stepObj || stepIndex === -1) {
    return <Redirect to={`/onboarding/${organization.slug}/${onboardingSteps[0].id}/`} />;
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
      <Container hasFooter={containerHasFooter}>
        <Back animate={stepIndex > 0 ? 'visible' : 'hidden'} onClick={handleGoBack} />
        <AnimatePresence exitBeforeEnter onExitComplete={updateAnimationState}>
          <OnboardingStep key={stepObj.id} data-test-id={`onboarding-step-${stepObj.id}`}>
            {stepObj.Component && (
              <stepObj.Component
                active
                data-test-id={`onboarding-step-${stepObj.id}`}
                stepIndex={stepIndex}
                onComplete={() => stepObj && goNextStep(stepObj)}
                orgId={props.params.orgId}
                organization={props.organization}
                search={props.location.search}
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

const Container = styled('div')<{hasFooter: boolean}>`
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  position: relative;
  background: ${p => p.theme.background};
  padding: 120px ${space(3)};
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

export default withOrganization(withProjects(Onboarding));
