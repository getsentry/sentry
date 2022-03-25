import * as React from 'react';
import {browserHistory, RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import {AnimatePresence, motion, MotionProps, useAnimation} from 'framer-motion';

import Button, {ButtonProps} from 'sentry/components/button';
import Hook from 'sentry/components/hook';
import LogoSentry from 'sentry/components/logoSentry';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {IconArrow} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization, Project} from 'sentry/types';
import testableTransition from 'sentry/utils/testableTransition';
import withOrganization from 'sentry/utils/withOrganization';
import withProjects from 'sentry/utils/withProjects';
import PageCorners from 'sentry/views/onboarding/components/pageCorners';

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
  },
  {
    id: 'select-platform',
    title: t('Select a platform'),
    Component: PlatformSelection,
  },
  {
    id: 'setup-docs',
    title: t('Install the Sentry SDK'),
    Component: SetupDocs,
    hasFooter: true,
  },
];

function Onboarding(props: Props) {
  const stepId = props.params.step;
  const stepObj = ONBOARDING_STEPS.find(({id}) => stepId === id);
  if (!stepObj) {
    return <div>Can't find</div>;
  }

  const cornerVariantControl = useAnimation();
  const updateCornerVariant = () => {
    // TODO: find better way to delay thhe corner animation
    setTimeout(() => cornerVariantControl.start('top-right'), 1000);
  };

  React.useEffect(updateCornerVariant, []);

  const goNextStep = (step: StepDescriptor) => {
    const stepIndex = ONBOARDING_STEPS.findIndex(s => s.id === step.id);
    const nextStep = ONBOARDING_STEPS[stepIndex + 1];

    browserHistory.push(`/onboarding/${props.params.orgId}/${nextStep.id}/`);
  };

  const activeStepIndex = ONBOARDING_STEPS.findIndex(({id}) => props.params.step === id);

  const handleGoBack = () => {
    const previousStep = ONBOARDING_STEPS[activeStepIndex - 1];
    browserHistory.replace(`/onboarding/${props.params.orgId}/${previousStep.id}/`);
  };

  return (
    <OnboardingWrapper data-test-id="targeted-onboarding">
      <SentryDocumentTitle title={t('Welcome')} />
      <Header>
        <LogoSvg />
        <Hook name="onboarding:targeted-onboarding-header" />
      </Header>
      <Container hasFooter={!!stepObj.hasFooter}>
        <Back
          animate={activeStepIndex > 0 ? 'visible' : 'hidden'}
          onClick={handleGoBack}
        />
        <AnimatePresence exitBeforeEnter onExitComplete={updateCornerVariant}>
          <OnboardingStep
            centered={stepObj.centered}
            key={stepObj.id}
            data-test-id={`onboarding-step-${stepObj.id}`}
          >
            {stepObj.Component && (
              <stepObj.Component
                active
                onComplete={() => goNextStep(stepObj)}
                orgId={props.params.orgId}
                organization={props.organization}
                search={props.location.search}
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
  display: flex;
  justify-content: space-between;
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

export default withOrganization(withProjects(Onboarding));
