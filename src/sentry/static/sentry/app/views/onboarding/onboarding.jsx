import {browserHistory} from 'react-router';
import DocumentTitle from 'react-document-title';
import PropTypes from 'prop-types';
import React from 'react';
import posed, {PoseGroup} from 'react-pose';
import scrollToElement from 'scroll-to-element';
import styled from '@emotion/styled';

import {analytics} from 'app/utils/analytics';
import {t} from 'app/locale';
import Hook from 'app/components/hook';
import InlineSvg from 'app/components/inlineSvg';
import OnboardingPlatform from 'app/views/onboarding/platform';
import OnboardingProjectSetup from 'app/views/onboarding/projectSetup';
import OnboardingWelcome from 'app/views/onboarding/welcome';
import PageHeading from 'app/components/pageHeading';
import SentryTypes from 'app/sentryTypes';
import space from 'app/styles/space';
import testablePose from 'app/utils/testablePose';
import withOrganization from 'app/utils/withOrganization';
import withProjects from 'app/utils/withProjects';

const recordAnalyticStepComplete = ({organization, project, step}) =>
  analytics('onboarding_v2.step_compete', {
    org_id: parseInt(organization.id, 10),
    project: project ? project.slug : null,
    step: step.id,
  });

const ONBOARDING_STEPS = [
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

const stepShape = PropTypes.shape({
  id: PropTypes.string,
  title: PropTypes.string,
  Component: PropTypes.func,
});

class Onboarding extends React.Component {
  static propTypes = {
    steps: PropTypes.arrayOf(stepShape),
    projects: PropTypes.arrayOf(SentryTypes.Project),
    organization: SentryTypes.Organization,
  };

  static defaultProps = {
    steps: ONBOARDING_STEPS,
  };

  state = {};

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
      (a, b) => new Date(a.dateCreated) - new Date(b.dateCreated)
    );

    return sortedProjects.length > 0 ? sortedProjects[0] : null;
  }

  get projectPlatform() {
    return this.state.platform || (this.firstProject && this.firstProject.platform);
  }

  handleUpdate = data => {
    this.setState(data);
  };

  handleNextStep(step, data) {
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

  handleReturnToStep(step, data) {
    const {orgId} = this.props.params;

    this.handleUpdate(data);
    browserHistory.push(`/onboarding/${orgId}/${step.id}/`);
  }

  scrollToActiveStep = () => {
    const step = this.activeStep;
    scrollToElement(`#onboarding_step_${step.id}`, {
      align: 'middle',
      duration: 300,
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
        onPoseComplete={this.scrollToActiveStep}
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
            <PoseGroup preEnterPose="init">
              <ProgressStatus key={this.activeStep.id}>
                {this.activeStep.title}
              </ProgressStatus>
            </PoseGroup>
          </Container>
        </Header>
        <Container>
          <PoseGroup flipMove={false}>{this.renderOnboardingSteps()}</PoseGroup>
        </Container>
        <Hook name="onboarding:extra-chrome" />
      </OnboardingWrapper>
    );
  }
}

const Theme = {
  colors: {
    gray: ['#f6f6f8', '9093c1', '#584674'],
    pink: '#e1567c',
  },
};

const OnboardingWrapper = styled('main')`
  flex-grow: 1;
  background: ${Theme.colors.gray[0]};
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
    background: ${p => p.theme.borderLight};
    left: 2px;
    right: 2px;
    top: 50%;
    margin-top: -2px;
  }
`;

const ProgressStep = styled('div')`
  position: relative;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 4px solid ${p => (p.active ? Theme.colors.pink : p.theme.borderLight)};
  background: #fff;
`;

const PosedProgressStatus = posed.div(
  testablePose({
    init: {opacity: 0, y: -10},
    enter: {opacity: 1, y: 0},
    exit: {opacity: 0, y: 10},
  })
);

const ProgressStatus = styled(PosedProgressStatus)`
  color: ${p => p.theme.gray600};
  font-size: ${p => p.theme.fontSizeMedium};
  text-align: right;
`;

const PosedOnboardingStep = posed.div(
  testablePose({
    enter: {opacity: 1, y: 0},
    exit: {opacity: 0, y: 100},
  })
);

const OnboardingStep = styled(PosedOnboardingStep)`
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
    background-color: ${p => (p.active ? Theme.colors.pink : p.theme.gray500)};
    border-radius: 50%;
    color: #fff;
    font-size: 1.5rem;
  }
`;

export const stepPropTypes = {
  scrollTargetId: PropTypes.string,
  active: PropTypes.bool,
  orgId: PropTypes.string,
  project: SentryTypes.Project,
  platform: PropTypes.string,
  onReturnToStep: PropTypes.func,
  onComplete: PropTypes.func,
  onUpdate: PropTypes.func,
};

export default withOrganization(withProjects(Onboarding));
