import * as React from 'react';
import {browserHistory, RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import {AnimatePresence, motion, MotionProps, useAnimation} from 'framer-motion';

import Button, {ButtonProps} from 'sentry/components/button';
import Hook from 'sentry/components/hook';
import Link from 'sentry/components/links/link';
import LogoSentry from 'sentry/components/logoSentry';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {PlatformKey} from 'sentry/data/platformCategories';
import {IconArrow} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization, Project} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import testableTransition from 'sentry/utils/testableTransition';
import withOrganization from 'sentry/utils/withOrganization';
import withProjects from 'sentry/utils/withProjects';
import PageCorners from 'sentry/views/onboarding/components/pageCorners';

import Stepper from './components/stepper';
import PlatformSelection from './platform';
import SetupDocs from './setupDocs';
import {StepDescriptor} from './types';
import TargetedOnboardingWelcome from './welcome';

type RouteParams = {
  orgId: string;
  step: string;
};

type Props = RouteComponentProps<RouteParams, {}> & {
  organization: Organization;
  projects: Project[];
};

const ONBOARDING_STEPS: StepDescriptor[] = [
  {
    id: 'welcome',
    title: t('Welcome'),
    Component: TargetedOnboardingWelcome,
    centered: true,
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

function Onboarding(props: Props) {
  const {
    organization,
    params: {step: stepId},
  } = props;
  const stepObj = ONBOARDING_STEPS.find(({id}) => stepId === id);
  const stepIndex = ONBOARDING_STEPS.findIndex(({id}) => stepId === id);
  if (!stepObj || stepIndex === -1) {
    return <div>Can't find</div>;
  }

  const cornerVariantControl = useAnimation();
  const [containerHasFooter, setContainerHasFooter] = React.useState<boolean>(false);
  const updateAnimationState = () => {
    setContainerHasFooter(stepObj.hasFooter ?? false);
    cornerVariantControl.start(stepObj.cornerVariant);
  };

  React.useEffect(updateAnimationState, []);
  const [platforms, setPlatforms] = React.useState<PlatformKey[]>([]);

  const addPlatform = (platform: PlatformKey) => {
    setPlatforms([...platforms, platform]);
  };

  const removePlatform = (platform: PlatformKey) => {
    setPlatforms(platforms.filter(p => p !== platform));
  };

  const clearPlatforms = () => setPlatforms([]);

  const goToStep = (step: StepDescriptor) => {
    if (step.cornerVariant !== stepObj.cornerVariant) {
      cornerVariantControl.start('none');
    }
    browserHistory.push(`/onboarding/${props.params.orgId}/${step.id}/`);
  };

  const goNextStep = (step: StepDescriptor) => {
    const currentStepIndex = ONBOARDING_STEPS.findIndex(s => s.id === step.id);
    const nextStep = ONBOARDING_STEPS[currentStepIndex + 1];
    if (step.cornerVariant !== nextStep.cornerVariant) {
      cornerVariantControl.start('none');
    }

    browserHistory.push(`/onboarding/${props.params.orgId}/${nextStep.id}/`);
  };

  const activeStepIndex = ONBOARDING_STEPS.findIndex(({id}) => props.params.step === id);

  const handleGoBack = () => {
    const previousStep = ONBOARDING_STEPS[activeStepIndex - 1];
    if (stepObj.cornerVariant !== previousStep.cornerVariant) {
      cornerVariantControl.start('none');
    }
    browserHistory.replace(`/onboarding/${props.params.orgId}/${previousStep.id}/`);
  };

  const genSkipOnboardingLink = () => {
    const source = `targeted-onboarding-${stepId}`;
    return (
      <SkipOnboardingLink
        onClick={() =>
          trackAdvancedAnalyticsEvent('growth.onboarding_clicked_skip', {
            organization,
            source,
          })
        }
        to={`/organizations/${organization.slug}/issues/`}
      >
        {t('Skip Onboarding')}
      </SkipOnboardingLink>
    );
  };

  return (
    <OnboardingWrapper data-test-id="targeted-onboarding">
      <SentryDocumentTitle title={stepObj.title} />
      <Header>
        <LogoSvg />
        <StyledStepper
          numSteps={ONBOARDING_STEPS.length}
          currentStepIndex={stepIndex}
          onClick={i => goToStep(ONBOARDING_STEPS[i])}
        />
        <UpsellWrapper>
          <Hook
            name="onboarding:targeted-onboarding-header"
            source="targeted-onboarding"
          />
        </UpsellWrapper>
      </Header>
      <Container hasFooter={containerHasFooter}>
        <Back
          animate={activeStepIndex > 0 ? 'visible' : 'hidden'}
          onClick={handleGoBack}
        />
        <AnimatePresence exitBeforeEnter onExitComplete={updateAnimationState}>
          <OnboardingStep
            centered={stepObj.centered}
            key={stepObj.id}
            data-test-id={`onboarding-step-${stepObj.id}`}
          >
            {stepObj.Component && (
              <stepObj.Component
                active
                stepIndex={activeStepIndex}
                onComplete={() => goNextStep(stepObj)}
                orgId={props.params.orgId}
                organization={props.organization}
                search={props.location.search}
                {...{
                  platforms,
                  addPlatform,
                  removePlatform,
                  genSkipOnboardingLink,
                  clearPlatforms,
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

const OnboardingWrapper = styled('main')`
  overflow: hidden;
  display: flex;
  flex-direction: column;
  flex-grow: 1;
`;

const Container = styled('div')<{hasFooter: boolean}>`
  display: flex;
  justify-content: center;
  position: relative;
  background: ${p => p.theme.background};
  padding: 120px ${space(3)};
  width: 100%;
  margin: 0 auto;
  flex-grow: 1;
  padding-bottom: ${p => p.hasFooter && '72px'};
  margin-bottom: ${p => p.hasFooter && '72px'};
`;

const Header = styled('header')`
  background: ${p => p.theme.background};
  padding: ${space(4)};
  position: sticky;
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

const OnboardingStep = styled(motion.div)<{centered?: boolean}>`
  display: flex;
  flex-direction: column;
  ${p =>
    p.centered &&
    `justify-content: center;
     align-items: center;`};
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
  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    --corner-scale: 0.5;
  }
`;

const StyledStepper = styled(Stepper)`
  margin-left: auto;
  margin-right: auto;
  align-self: center;
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

export default withOrganization(withProjects(Onboarding));
