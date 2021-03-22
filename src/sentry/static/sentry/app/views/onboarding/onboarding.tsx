import React from 'react';
import DocumentTitle from 'react-document-title';
import {browserHistory, RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import {AnimatePresence, motion, useAnimation} from 'framer-motion';

import Button from 'app/components/button';
import Hook from 'app/components/hook';
import {IconChevron, IconSentryFull} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Organization, Project} from 'app/types';
import {analytics} from 'app/utils/analytics';
import testableTransition from 'app/utils/testableTransition';
import withOrganization from 'app/utils/withOrganization';
import withProjects from 'app/utils/withProjects';

import PageCorners from './components/pageCorners';
import OnboardingPlatform from './platform';
import SdkConfiguration from './sdkConfiguration';
import {StepData, StepDescriptor} from './types';
import OnboardingWelcome from './welcome';

type AnalyticsOpts = {
  organization: Organization;
  project: Project | null;
  step: StepDescriptor;
};

const recordAnalyticStepComplete = ({organization, project, step}: AnalyticsOpts) =>
  analytics('onboarding_v2.step_compete', {
    org_id: parseInt(organization.id, 10),
    project: project ? project.slug : null,
    step: step.id,
  });

const ONBOARDING_STEPS: StepDescriptor[] = [
  {
    id: 'welcome',
    title: t('Welcome to Sentry'),
    Component: OnboardingWelcome,
    centered: true,
  },
  {
    id: 'select-platform',
    title: t('Select a platform'),
    Component: OnboardingPlatform,
  },
  {
    id: 'get-started',
    title: t('Install the Sentry SDK'),
    Component: SdkConfiguration,
  },
];

type RouteParams = {
  orgId: string;
  step: string;
};

type DefaultProps = {
  steps: StepDescriptor[];
};

type Props = RouteComponentProps<RouteParams, {}> &
  DefaultProps & {
    organization: Organization;
    projects: Project[];
  };

type State = StepData;

class Onboarding extends React.Component<Props, State> {
  static defaultProps: DefaultProps = {
    steps: ONBOARDING_STEPS,
  };

  state: State = {};

  componentDidMount() {
    this.validateActiveStep();
  }

  componentDidUpdate() {
    this.validateActiveStep();
  }

  validateActiveStep() {
    if (this.activeStepIndex === -1) {
      const firstStep = this.props.steps[0].id;
      browserHistory.replace(`/onboarding/${this.props.params.orgId}/${firstStep}/`);
    }
  }

  get activeStepIndex() {
    return this.props.steps.findIndex(({id}) => this.props.params.step === id);
  }

  get activeStep() {
    return this.props.steps[this.activeStepIndex];
  }

  get firstProject() {
    const sortedProjects = this.props.projects.sort(
      (a, b) => new Date(a.dateCreated).getTime() - new Date(b.dateCreated).getTime()
    );

    return sortedProjects.length > 0 ? sortedProjects[0] : null;
  }

  get projectPlatform() {
    return this.state.platform ?? this.firstProject?.platform ?? null;
  }

  handleUpdate = (data: StepData) => {
    this.setState(data);
  };

  handleNextStep(step: StepDescriptor, data: StepData) {
    this.handleUpdate(data);

    if (step !== this.activeStep) {
      return;
    }

    const {orgId} = this.props.params;
    const nextStep = this.props.steps[this.activeStepIndex + 1];

    recordAnalyticStepComplete({
      organization: this.props.organization,
      project: this.firstProject,
      step: nextStep,
    });

    browserHistory.push(`/onboarding/${orgId}/${nextStep.id}/`);
  }

  handleGoBack = () => {
    const previousStep = this.props.steps[this.activeStepIndex - 1];
    browserHistory.replace(`/onboarding/${this.props.params.orgId}/${previousStep.id}/`);
  };

  renderProgressBar() {
    const activeStepIndex = this.activeStepIndex;
    return (
      <ProgressBar>
        {this.props.steps.map((step, index) => (
          <ProgressStep active={activeStepIndex === index} key={step.id} />
        ))}
      </ProgressBar>
    );
  }

  renderOnboardingStep() {
    const {orgId} = this.props.params;
    const step = this.activeStep;

    return (
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
        />
      </OnboardingStep>
    );
  }

  Contents = () => {
    const cornerVariantControl = useAnimation();
    const updateCornerVariant = () => {
      cornerVariantControl.start(this.activeStepIndex === 0 ? 'top-right' : 'top-left');
    };

    // XXX(epurkhiser): We're using a react hook here becuase there's no other
    // way to create framer-motion controls than by using the `useAnimation`
    // hook.

    // eslint-disable-next-line sentry/no-react-hooks
    React.useEffect(updateCornerVariant, []);

    return (
      <Container>
        <Back
          animate={this.activeStepIndex > 0 ? 'visible' : 'hidden'}
          onClick={this.handleGoBack}
        />
        <AnimatePresence exitBeforeEnter onExitComplete={updateCornerVariant}>
          {this.renderOnboardingStep()}
        </AnimatePresence>
        <PageCorners animateVariant={cornerVariantControl} />
      </Container>
    );
  };

  render() {
    if (this.activeStepIndex === -1) {
      return null;
    }

    return (
      <OnboardingWrapper>
        <DocumentTitle title={this.activeStep.title} />
        <Header>
          <LogoSvg />
          <HeaderRight>
            {this.renderProgressBar()}
            <Hook name="onboarding:extra-chrome" />
          </HeaderRight>
        </Header>
        <this.Contents />
      </OnboardingWrapper>
    );
  }
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

const LogoSvg = styled(IconSentryFull)`
  width: 130px;
  height: 30px;
  color: ${p => p.theme.textColor};
`;

const ProgressBar = styled('div')`
  margin: 0 ${space(4)};
  position: relative;
  display: flex;
  align-items: center;
  min-width: 120px;
  justify-content: space-between;

  &:before {
    position: absolute;
    display: block;
    content: '';
    height: 4px;
    background: ${p => p.theme.inactive};
    left: 2px;
    right: 2px;
    top: 50%;
    margin-top: -2px;
  }
`;

const ProgressStep = styled('div')<{active: boolean}>`
  position: relative;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 4px solid ${p => (p.active ? p.theme.active : p.theme.inactive)};
  background: ${p => p.theme.background};
`;

const ProgressStatus = styled(motion.div)`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeMedium};
  text-align: right;
  grid-column: 3;
  grid-row: 1;
`;

const HeaderRight = styled('div')`
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: max-content;
  grid-gap: ${space(1)};
`;

ProgressStatus.defaultProps = {
  initial: {opacity: 0, y: -10},
  animate: {opacity: 1, y: 0},
  exit: {opacity: 0, y: 10},
  transition: testableTransition(),
};

const Back = styled(({className, animate, ...props}) => (
  <motion.div
    className={className}
    animate={animate}
    transition={testableTransition()}
    variants={{
      initial: {opacity: 0},
      visible: {opacity: 1, transition: testableTransition({delay: 1})},
      hidden: {opacity: 0},
    }}
  >
    <Button {...props} icon={<IconChevron direction="left" size="sm" />} priority="link">
      {t('Go back')}
    </Button>
  </motion.div>
))`
  position: absolute;
  top: 40px;
  left: 20px;

  button {
    font-size: ${p => p.theme.fontSizeSmall};
    color: ${p => p.theme.subText};
  }
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
