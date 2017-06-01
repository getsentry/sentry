import React from 'react';
import {onboardingSteps} from './utils';
import EmailField from '../../components/forms/emailField';
import TextFieldField from '../../components/forms/textField';

const Project = React.createClass({
  getInitialState() {
    return {
      email: ''
    };
  },

  steps: Object.keys(onboardingSteps),
  render() {
    return (
      <div className="onboarding-info">
        <h2>Project Name</h2>
        <EmailField name="email" />
        <h2>Language / platform</h2>
        <TextFieldField name="email" />
      </div>
    );
  }
});

export default Project;
