import React from 'react';
import PropTypes from 'prop-types';
import DocumentTitle from 'react-document-title';
import styled from 'react-emotion';

import ProgressNodes from 'app/views/onboarding/progress';

class OnboardingWizard extends React.Component {
  static contextTypes = {
    organization: PropTypes.object,
  };

  render() {
    return (
      <OnboardingBackground>
        <div className="onboarding-container">
          <DocumentTitle title="Sentry" />
          <div className="step-container">
            <ProgressNodes params={this.props.params} />
            <div>{this.props.children}</div>
          </div>
        </div>
      </OnboardingBackground>
    );
  }
}

const OnboardingBackground = styled('div')`
  width: 100%;
  height: 100%;
  min-height: 100vh;
  background: #fff;
`;

export default OnboardingWizard;
