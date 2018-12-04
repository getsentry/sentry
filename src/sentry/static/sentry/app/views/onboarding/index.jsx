import React from 'react';
import PropTypes from 'prop-types';
import DocumentTitle from 'react-document-title';

import ProgressNodes from 'app/views/onboarding/progress';

class OnboardingWizard extends React.Component {
  static contextTypes = {
    organization: PropTypes.object,
  };

  constructor(props, context) {
    super(props, context);
    let {organization} = this.context;
    this.state = {
      showSurvey:
        organization && organization.experiments.OnboardingSurveyExperiment === 1,
    };
  }

  handleSurveySubmit = () => {
    this.setState({showSurvey: false});
  };

  render() {
    return (
      <div className="onboarding-container">
        <DocumentTitle title={'Sentry'} />
        <div className="step-container">
          <ProgressNodes showSurvey={this.state.showSurvey} params={this.props.params} />
          <div>
            {React.cloneElement(this.props.children, {
              showSurvey: this.state.showSurvey,
              onSurveySubmit: this.handleSurveySubmit,
            })}
          </div>
        </div>
      </div>
    );
  }
}

export default OnboardingWizard;
