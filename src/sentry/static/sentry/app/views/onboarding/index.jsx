import React from 'react';
import PropTypes from 'prop-types';
import DocumentTitle from 'react-document-title';

import ProgressNodes from './progress';

const OnboardingWizard = React.createClass({
  contextTypes: {
    organization: PropTypes.object
  },

  render() {
    return (
      <div className="onboarding-container">
        <DocumentTitle title={'Sentry'} />
        <div className="step-container">
          <ProgressNodes params={this.props.params} />
          <div>
            {this.props.children}
          </div>
        </div>
      </div>
    );
  }
});

export default OnboardingWizard;
