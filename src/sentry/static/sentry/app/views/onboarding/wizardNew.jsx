import {browserHistory} from 'react-router';
import DocumentTitle from 'react-document-title';
import PropTypes from 'prop-types';
import React from 'react';
import posed, {PoseGroup} from 'react-pose';
import scrollToElemennt from 'scroll-to-element';
import styled from 'react-emotion';

import {t} from 'app/locale';
import InlineSvg from 'app/components/inlineSvg';
import OnboardingPlatform from 'app/views/onboarding/platform';
import OnboardingProjectSetup from 'app/views/onboarding/projectSetup';
import OnboardingWelcome from 'app/views/onboarding/welcome';
import PageHeading from 'app/components/pageHeading';
import SentryTypes from 'app/sentryTypes';
import space from 'app/styles/space';
import withProjects from 'app/utils/withProjects';

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

class OnboardingWizard extends React.Component {
  static propTypes = {
    projects: PropTypes.arrayOf(SentryTypes.Project),
  };

  state = {};

  get activeStepIndex() {
    return ONBOARDING_STEPS.findIndex(({id}) => this.props.params.step === id);
  }

  get activeStep() {
    return ONBOARDING_STEPS[this.activeStepIndex];
  }

  get firstProject() {
    const sortedProjects = this.props.projects.sort(
      (a, b) => new Date(b.dateCreated) - new Date(a.dateCreated)
    );

    return sortedProjects.length > 0 ? sortedProjects[0] : null;
  }

  get projectPlatform() {
    return this.state.platform || this.firstProject?.platform;
  }

  handleUpdate = data => {
    this.setState(data);
  };

  handleNextStep = step => data => {
    this.handleUpdate(data);

    if (step !== this.activeStep) {
      return;
    }

    const {orgId} = this.props.params;
    const nextStep = ONBOARDING_STEPS[this.activeStepIndex + 1];
    browserHistory.push(`/onboarding/${orgId}/${nextStep.id}/`);
  };

  handleReturnToStep = step => data => {
    const {orgId} = this.props.params;

    this.handleUpdate(data);
    browserHistory.push(`/onboarding/${orgId}/${step.id}/`);
  };

  scrollToActiveStep = () => {
    const step = this.activeStep;
    scrollToElemennt(`#onboarding_step_${step.id}`, {
      align: 'middle',
      duration: 300,
    });
  };

  renderProgressBar() {
    const activeStepIndex = this.activeStepIndex;
    return (
      <ProgressBar>
        {ONBOARDING_STEPS.map((step, index) => (
          <ProgressStep active={activeStepIndex === index} key={step.id} />
        ))}
      </ProgressBar>
    );
  }

  renderOnboardingSteps() {
    const activeStepIndex = this.activeStepIndex;
    const {orgId} = this.props.params;

    if (activeStepIndex === -1) {
      // TODO: Redirect here?
    }

    const visibleSteps = ONBOARDING_STEPS.slice(0, activeStepIndex + 1);

    return visibleSteps.map((step, index) => (
      <OnboardingStep
        key={step.id}
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
          onReturnToStep={this.handleReturnToStep(step)}
          onComplete={this.handleNextStep(step)}
          onUpdate={this.handleUpdate}
        />
      </OnboardingStep>
    ));
  }

  render() {
    return (
      <OnboardingWrapper>
        <DocumentTitle title="Get Started on Sentry" />
        <Header>
          <Container>
            <HeaderColumn>
              <LogoSvg src="logo" />
            </HeaderColumn>
            <HeaderColumn>{this.renderProgressBar()}</HeaderColumn>
            <HeaderColumn>
              <ProgressStatus>{this.activeStep.title}</ProgressStatus>
            </HeaderColumn>
          </Container>
        </Header>
        <Container>
          <PoseGroup flipMove={false}>{this.renderOnboardingSteps()}</PoseGroup>
        </Container>
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
  background: ${Theme.colors.gray[0]};
  padding-bottom: 50vh;
`;

const Container = styled.div`
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
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
`;

const HeaderColumn = styled('div')`
  width: 33.3%;

  &:last-child {
    text-align: right;
  }
`;

const LogoSvg = styled(InlineSvg)`
  width: 130px;
  height: 30px;
  color: ${p => p.theme.gray5};
`;

const PosedOnboardingStep = posed.div({
  enter: {opacity: 1, y: 0},
  exit: {opacity: 0, y: 100},
});

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

const ProgressStatus = styled('div')`
  color: ${p => p.theme.gray3};
  font-size: ${p => p.theme.fontSizeMedium};
`;

export const OnboardingStep = styled(PosedOnboardingStep)`
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
    top: -4px;
    left: -30px;
    background-color: ${p => (p.active ? Theme.colors.pink : p.theme.gray2)};
    border-radius: 50%;
    color: #fff;
    font-size: 1.5rem;
  }
`;

export default withProjects(OnboardingWizard);
