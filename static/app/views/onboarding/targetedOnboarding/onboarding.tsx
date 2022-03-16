import * as React from 'react';
import {useState} from 'react';
import {browserHistory, RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import {AnimatePresence, motion, useAnimation} from 'framer-motion';

import Hook from 'sentry/components/hook';
import LogoSentry from 'sentry/components/logoSentry';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization, Project} from 'sentry/types';
import testableTransition from 'sentry/utils/testableTransition';
import withOrganization from 'sentry/utils/withOrganization';
import withProjects from 'sentry/utils/withProjects';
import PageCorners from 'sentry/views/onboarding/components/pageCorners';

import PlatformSelection from './platform';
import SetupDocs from './setupDocs';
import {StepData, StepDescriptor} from './types';
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
    cornerVariantControl.start('top-right');
  };

  React.useEffect(updateCornerVariant, []);

  const [_stepState, setStepState] = useState<StepData>({
    platform: null,
  });

  const goNextStep = (step: StepDescriptor, data: StepData) => {
    setStepState(data);

    const stepIndex = ONBOARDING_STEPS.findIndex(s => s.id === step.id);
    const nextStep = ONBOARDING_STEPS[stepIndex + 1];

    browserHistory.push(`/onboarding/${props.params.orgId}/${nextStep.id}/`);
  };
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
            centered={stepObj.centered}
            key={stepObj.id}
            data-test-id={`onboarding-step-${stepObj.id}`}
          >
            {stepObj.Component && (
              <stepObj.Component
                active
                onComplete={data => goNextStep(stepObj, data)}
                onUpdate={() => {}}
                orgId={props.params.orgId}
                organization={props.organization}
              />
            )}
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

export default withOrganization(withProjects(Onboarding));
