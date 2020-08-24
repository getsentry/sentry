import {browserHistory, RouteComponentProps} from 'react-router';
import DocumentTitle from 'react-document-title';
import React from 'react';
import {motion, AnimatePresence} from 'framer-motion';
import scrollToElement from 'scroll-to-element';
import styled from '@emotion/styled';

import {IS_ACCEPTANCE_TEST} from 'app/constants';
import {analytics} from 'app/utils/analytics';
import {t} from 'app/locale';
import Hook from 'app/components/hook';
import InlineSvg from 'app/components/inlineSvg';
import PageHeading from 'app/components/pageHeading';
import space from 'app/styles/space';
import withOrganization from 'app/utils/withOrganization';
import withProjects from 'app/utils/withProjects';
import testableTransition from 'app/utils/testableTransition';
import {Organization, Project} from 'app/types';

import {StepDescriptor, StepData} from './types';
import OnboardingPlatform from './platform';
import OnboardingProjectSetup from './projectSetup';
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
  },
  {
    id: 'select-platform',
    title: t('Select a platform'),
    Component: OnboardingPlatform,
  },
  {
    id: 'get-started',
    title: t('Install the Sentry SDK'),
    Component: OnboardingProjectSetup,
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

  handleReturnToStep(step: StepDescriptor, data: StepData) {
    const {orgId} = this.props.params;

    this.handleUpdate(data);
    browserHistory.push(`/onboarding/${orgId}/${step.id}/`);
  }

  scrollToActiveStep = () => {
    const step = this.activeStep;
    scrollToElement(`#onboarding_step_${step.id}`, {
      align: 'middle',
      offset: 0,
      // Disable animations in CI - must be < 0 to disable
      duration: IS_ACCEPTANCE_TEST ? -1 : 300,
    });
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

  renderOnboardingSteps() {
    const {orgId} = this.props.params;
    const activeStepIndex = this.activeStepIndex;
    const visibleSteps = this.props.steps.slice(0, activeStepIndex + 1);

    return visibleSteps.map((step, index) => (
      <OnboardingStep
        key={step.id}
        data-test-id={`onboarding-step-${step.id}`}
        onAnimationComplete={this.scrollToActiveStep}
        active={activeStepIndex === index}
      >
        <PageHeading withMargins>{step.title}</PageHeading>
        <step.Component
          scrollTargetId={`onboarding_step_${step.id}`}
          active={activeStepIndex === index}
          orgId={orgId}
          project={this.firstProject}
          platform={this.projectPlatform}
          onReturnToStep={data => this.handleReturnToStep(step, data)}
          onComplete={data => this.handleNextStep(step, data)}
          onUpdate={this.handleUpdate}
        />
      </OnboardingStep>
    ));
  }

  render() {
    if (this.activeStepIndex === -1) {
      return null;
    }

    return (
      <OnboardingWrapper>
        <DocumentTitle title="Get Started on Sentry" />
        <Header>
          <Container>
            <LogoSvg src="logo" />
            {this.renderProgressBar()}
            <AnimatePresence initial={false}>
              <ProgressStatus key={this.activeStep.id}>
                {this.activeStep.title}
              </ProgressStatus>
            </AnimatePresence>
          </Container>
        </Header>
        <Container>
          <AnimatePresence initial={false}>
            {this.renderOnboardingSteps()}
          </AnimatePresence>
        </Container>
        <Hook name="onboarding:extra-chrome" />
      </OnboardingWrapper>
    );
  }
}

const OnboardingWrapper = styled('main')`
  flex-grow: 1;
  background: ${p => p.theme.gray100};
  padding-bottom: 50vh;
`;

const Container = styled('div')`
  padding: 0 ${space(3)};
  max-width: ${p => p.theme.breakpoints[0]};
  width: 100%;
  margin: 0 auto;
`;

const Header = styled('header')`
  background: #fff;
  padding: ${space(4)} 0;
  position: sticky;
  top: 0;
  z-index: 100;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.02);

  ${Container} {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    align-items: center;
  }
`;

const LogoSvg = styled(InlineSvg)`
  width: 130px;
  height: 30px;
  color: ${p => p.theme.gray800};
`;

const ProgressBar = styled('div')`
  margin: 0 ${space(4)};
  position: relative;
  display: flex;
  justify-content: space-between;

  &:before {
    position: absolute;
    display: block;
    content: '';
    height: 4px;
    background: ${p => p.theme.border};
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
  border: 4px solid ${p => (p.active ? p.theme.pink400 : p.theme.border)};
  background: #fff;
`;

const ProgressStatus = styled(motion.div)`
  color: ${p => p.theme.gray600};
  font-size: ${p => p.theme.fontSizeMedium};
  text-align: right;
  grid-column: 3;
  grid-row: 1;
`;

ProgressStatus.defaultProps = {
  initial: {opacity: 0, y: -10},
  animate: {opacity: 1, y: 0},
  exit: {opacity: 0, y: 10},
  transition: testableTransition(),
};

const OnboardingStep = styled(motion.div)<{active: boolean}>`
  margin: 70px 0;
  margin-left: -20px;
  padding-left: 18px;
  counter-increment: step;
  position: relative;

  &:before {
    content: counter(step);
    position: absolute;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    top: -5px;
    left: -30px;
    background-color: ${p => (p.active ? p.theme.pink400 : p.theme.gray500)};
    border-radius: 50%;
    color: #fff;
    font-size: 1.5rem;
  }
`;

OnboardingStep.defaultProps = {
  initial: {opacity: 0, y: 100},
  animate: {opacity: 1, y: 0},
  exit: {opacity: 0, y: 100},
  transition: testableTransition(),
};

export default withOrganization(withProjects(Onboarding));
