import React from 'react';
import DocumentTitle from 'react-document-title';

import ApiMixin from '../../mixins/apiMixin';
import ProgressNodes from './progress';

const OnboardingWizard = React.createClass({
  contextTypes: {
    organization: React.PropTypes.object
  },

  mixins: [ApiMixin],

  getInitialState() {
    return {
      // loading: true,
      // error: false,
      // platform: '',
      // projectName: ''
    };
  },

  renderStep() {
    return React.cloneElement(this.props.children);
  },

  render() {
    return (
      <div className="onboarding-container">
        <DocumentTitle title={'Sentry'} />
        <div className="step-container">
          <ProgressNodes params={this.props.params} />
          <div>
            <this.renderStep />
          </div>
        </div>
      </div>
    );
  }
});

export default OnboardingWizard;
