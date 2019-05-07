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
    component: OnboardingWelcome,
  },
  {
    id: 'select-platform',
    title: t('Platform Selection'),
    component: OnboardingPlatform,
  },
  {
    id: 'get-started',
    title: t('Getting Started with Sentry'),
    component: OnboardingProjectSetup,
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

  renderOnboardingSteps() {
    const activeStepIndex = this.activeStepIndex;
    const {orgId} = this.props.params;

    if (activeStepIndex === -1) {
      // TODO: Redirect here?
    }

    const visibleSteps = ONBOARDING_STEPS.slice(0, activeStepIndex + 1);

    return visibleSteps.map((step, index) => (
      <OnboardingStep key={step.id} onPoseComplete={this.scrollToActiveStep}>
        <PageHeading withMargins>{step.title}</PageHeading>
        <step.component
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
      <OnboardingContainer>
        <DocumentTitle title="Get Started on Sentry" />
        <Header>
          <LogoSvg src="logo" />
        </Header>
        <PoseGroup flipMove={false}>{this.renderOnboardingSteps()}</PoseGroup>
      </OnboardingContainer>
    );
  }
}

const OnboardingContainer = styled('main')`
  max-width: ${p => p.theme.breakpoints[0]};
  margin: ${space(4)} ${space(3)} 50vh;
  width: 100%;
  align-self: center;
`;

const Header = styled('header')`
  margin-bottom: ${space(4)};
`;

const LogoSvg = styled(InlineSvg)`
  width: 150px;
  height: 52px;
  background-color: ${p => p.theme.gray5};
  color: #fff;
`;

const PosedOnboardingStep = posed.div({
  enter: {opacity: 1, y: 0},
  exit: {opacity: 0, y: 100},
});

export const OnboardingStep = styled(PosedOnboardingStep)`
  margin: ${space(4)} 0;
  margin-left: -20px;
  padding-left: 18px;
  border-left: 2px solid ${p => p.theme.borderLighter};
  counter-increment: step;
  position: relative;

  &:before {
    content: counter(step);
    position: absolute;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    left: -20px;
    background-color: ${p => p.theme.gray5};
    color: #fff;
    font-size: 1.5rem;
  }
`;

export default withProjects(OnboardingWizard);
