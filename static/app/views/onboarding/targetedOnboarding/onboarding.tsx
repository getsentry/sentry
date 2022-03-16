import * as React from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import {AnimatePresence, motion, useAnimation} from 'framer-motion';

import Hook from 'sentry/components/hook';
import LogoSentry from 'sentry/components/logoSentry';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import testableTransition from 'sentry/utils/testableTransition';
import PageCorners from 'sentry/views/onboarding/components/pageCorners';
import {StepDescriptor} from 'sentry/views/onboarding/types';

import TargetedOnboardingInstallation from './installation';
import TargetedOnboardingWelcome from './welcome';
import {StepDescriptor} from './types';

const ONBOARDING_STEPS: StepDescriptor[] = [
  {
    id: 'welcome',
    title: t('Welcome'),
    Component: TargetedOnboardingWelcome,
    centered: true,
  },
  {
    id: 'get-started',
    title: t('Install the Sentry SDK'),
    Component: TargetedOnboardingInstallation,
  },
];

type RouteParams = {
  orgId: string;
  step: string;
};

type Props = RouteComponentProps<RouteParams, {}>;

export default function Onboarding({params}: Props) {
  const cornerVariantControl = useAnimation();
  const updateCornerVariant = () => {
    cornerVariantControl.start('top-right');
  };

  // XXX(epurkhiser): We're using a react hook here becuase there's no other
  // way to create framer-motion controls than by using the `useAnimation`
  // hook.

  React.useEffect(updateCornerVariant, []);

  const activeStepIndex = ONBOARDING_STEPS.findIndex(({id}) => params.step === id);
  const step = ONBOARDING_STEPS[activeStepIndex];

  return (
    <OnboardingWrapper data-test-id="targeted-onboarding">
      <SentryDocumentTitle title={t('Welcome')} />
      <Header>
        <LogoSvg />
        <Hook name="onboarding:targeted-onboarding-header" />
      </Header>
      <Container>
        <AnimatePresence exitBeforeEnter onExitComplete={updateCornerVariant}>
          <OnboardingStep
            centered={step.centered}
            key={step.id}
            data-test-id={`onboarding-step-${step.id}`}
          >
            <step.Component
              active
              orgId={orgId}
              project={this.firstProject}
              platform={this.projectPlatform}
              onComplete={data => this.handleNextStep(step, data)}
              onUpdate={this.handleUpdate}
              organization={this.props.organization}
            />
          </OnboardingStep>
        </AnimatePresence>
        <PageCorners animateVariant={cornerVariantControl} />
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

const Container = styled('div')`
  display: flex;
  justify-content: center;
  position: relative;
  background: ${p => p.theme.background};
  padding: 120px ${space(3)};
  padding-top: 12vh;
  width: 100%;
  margin: 0 auto;
  flex-grow: 1;
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
  width: 850px;
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
